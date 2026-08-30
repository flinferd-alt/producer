<?php
// Отключаем стандартный HTML-вывод ошибок
ini_set('display_errors', '0');
error_reporting(E_ALL);

// Супер-перехватчик ошибок
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR, E_PARSE])) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error'   => 'Фатальная ошибка PHP: ' . $error['message'],
            'file'    => $error['file'],
            'line'    => $error['line']
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
});

try {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/auth_helper.php';
    require_once __DIR__ . '/yandex_gpt.php';

    cors();
    authenticate();

    $m  = method('GET', 'POST');
    $id = launchId();

    $db = db();

    /* запуск должен существовать */
    $chk = $db->prepare('SELECT id FROM launches WHERE id = ?');
    $chk->execute([$id]);
    if ($chk->fetch(PDO::FETCH_ASSOC) === false) {
        fail('Запуск не найден', 404);
    }

    if ($m === 'GET') {
        $b = $db->prepare('SELECT id, status, summary, updated_at FROM briefs WHERE launch_id = ? ORDER BY id DESC LIMIT 1');
        $b->execute([$id]);
        $brief = $b->fetch(PDO::FETCH_ASSOC);

        if (!$brief) {
            fail('Бриф ещё не заполнялся', 404);
        }

        $a = $db->prepare('SELECT key, label, value FROM brief_answers WHERE brief_id = ? ORDER BY id');
        $a->execute([(int) $brief['id']]);

        json_out(array_merge($brief, ['answers' => $a->fetchAll(PDO::FETCH_ASSOC)]));
    }

    /* --- POST: сохранение брифа --- */
    if ($m === 'POST') {
        // Freemium: платные пользователи могут перезапускать бриф, бесплатные — нет (если уже есть бриф)
        $existingBrief = $db->prepare('SELECT id FROM briefs WHERE launch_id = ? LIMIT 1');
        $existingBrief->execute([$id]);
        $hasBrief = $existingBrief->fetch(PDO::FETCH_ASSOC) !== false;

        if ($hasBrief) {
            $who = authenticate();
            $sub = $db->prepare('SELECT subscription_status FROM users WHERE id = ?');
            $sub->execute([$who['user_id']]);
            $subStatus = $sub->fetchColumn();
            if ($subStatus === 'free') {
                fail('Перезапуск брифа доступен на тарифе «Про». Оформите подписку для неограниченных попыток.', 402);
            }
        }

        $in      = input();
        $answers = $in['answers'] ?? null;

        if (!is_array($answers) || empty($answers)) {
            fail('Передайте answers: [{ key, label, value }, ...]', 400);
        }

        $db->beginTransaction();
        try {
            $st = $db->prepare(
                "INSERT INTO briefs (launch_id, status) VALUES (?, 'complete')
                 ON CONFLICT (launch_id) DO UPDATE SET status = 'complete', updated_at = now()
                 RETURNING id"
            );
            $st->execute([$id]);
            $briefId = (int) $st->fetchColumn();

            $db->prepare('DELETE FROM brief_answers WHERE brief_id = ?')->execute([$briefId]);
            $ins = $db->prepare('INSERT INTO brief_answers (brief_id, key, label, value) VALUES (?, ?, ?, ?)');

            foreach ($answers as $a) {
                if (is_array($a)) {
                    $ins->execute([
                        $briefId,
                        (string) ($a['key'] ?? ''),
                        (string) ($a['label'] ?? ''),
                        (string) ($a['value'] ?? ''),
                    ]);
                }
            }
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            fail('Сбой БД при сохранении: ' . $e->getMessage(), 500);
        }

        /* --- YandexGPT: summary брифа --- */
        $summary   = null;
        $ycStatus  = 'skipped';

        if (env('YANDEX_GPT_API_KEY') && env('YC_FOLDER_ID')) {
            try {
                $prompt = buildBriefPrompt($answers);
                $summary = callYandexGPT($prompt);
                $ycStatus = 'generated';
                $db->prepare('UPDATE briefs SET summary = ? WHERE id = ?')->execute([$summary, $briefId]);
            } catch (Throwable $e) {
                $ycStatus = 'error: ' . $e->getMessage();
            }
        }

        json_out([
            'brief_id' => $briefId,
            'summary'  => $summary,
            'yc'       => $ycStatus,
        ], 201);
    }

} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error'   => 'Исключение: ' . $e->getMessage(),
        'file'    => $e->getFile(),
        'line'    => $e->getLine()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}