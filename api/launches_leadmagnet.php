<?php

/**
 * launches_leadmagnet.php — лид-магнит от ИИ-копирайтера.
 *
 * GET  /api/launches/{id}/leadmagnet — получить текущий лид-магнит
 * POST /api/launches/{id}/leadmagnet — сгенерировать новый через YandexGPT
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

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

    // Проверяем существование запуска
    $chk = $db->prepare('SELECT id FROM launches WHERE id = ?');
    $chk->execute([$id]);
    if ($chk->fetch(PDO::FETCH_ASSOC) === false) {
        fail('Запуск не найден', 404);
    }

    /* ==================== GET ==================== */
    if ($m === 'GET') {
        $st = $db->prepare(
            'SELECT id, niche_name, variants, ai_verdict, recommended_idx, created_at
             FROM leadmagnet_snapshots
             WHERE launch_id = ?
             ORDER BY id DESC LIMIT 1'
        );
        $st->execute([$id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            fail('Лид-магнит ещё не сгенерирован', 404);
        }

        $row['variants']        = json_decode($row['variants'] ?? '[]', true) ?: [];
        $row['recommended_idx'] = (int) ($row['recommended_idx'] ?? 0);

        json_out($row);
    }

    /* ==================== POST ==================== */
    if ($m === 'POST') {

        // Проверяем, что продукт уже сгенерирован
        $launchStmt = $db->prepare('SELECT stage FROM launches WHERE id = ?');
        $launchStmt->execute([$id]);
        $launch = $launchStmt->fetch(PDO::FETCH_ASSOC);
        $stage = $launch['stage'] ?? '';

        if (!in_array($stage, ['product', 'funnel', 'traffic', 'sales'])) {
            fail('Сначала сгенерируйте стратегию продукта, прежде чем создавать лид-магнит', 400);
        }

        // Freemium: перегенерация — только для платных
        $existing = $db->prepare('SELECT id FROM leadmagnet_snapshots WHERE launch_id = ? LIMIT 1');
        $existing->execute([$id]);
        $hasLm = $existing->fetch(PDO::FETCH_ASSOC) !== false;

        if ($hasLm) {
            $who2 = authenticate();
            $sub2 = $db->prepare('SELECT subscription_status FROM users WHERE id = ?');
            $sub2->execute([$who2['user_id']]);
            $subStatus2 = $sub2->fetchColumn();
            if ($subStatus2 === 'free') {
                fail('Перегенерация лид-магнита доступна на тарифе «Про»', 402);
            }
        }

        // 1. Собираем контекст
        $briefText = extractBriefTextLm($db, $id);

        // Данные ниши
        $nicheStmt = $db->prepare(
            'SELECT niche_name, segments FROM niche_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1'
        );
        $nicheStmt->execute([$id]);
        $niche = $nicheStmt->fetch(PDO::FETCH_ASSOC);
        $nicheName = $niche['niche_name'] ?? 'онлайн-курс';
        $segments  = json_decode($niche['segments'] ?? '[]', true) ?: [];

        // Данные продукта
        $prodStmt = $db->prepare(
            'SELECT positioning, usp, tariffs FROM product_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1'
        );
        $prodStmt->execute([$id]);
        $prod = $prodStmt->fetch(PDO::FETCH_ASSOC);
        $positioning = $prod['positioning'] ?? '';
        $usp         = $prod['usp'] ?? '';
        $tariffs     = json_decode($prod['tariffs'] ?? '[]', true) ?: [];
        $mainPrice   = 0;
        foreach ($tariffs as $t) {
            if (!empty($t['hot'])) { $mainPrice = (int) ($t['price'] ?? 0); break; }
        }
        if ($mainPrice === 0 && count($tariffs) > 0) {
            $mainPrice = (int) ($tariffs[0]['price'] ?? 0);
        }

        // 2. Строим промпт
        $prompt = buildLeadMagnetPrompt($briefText, $nicheName, $segments, $positioning, $usp, $mainPrice);

        // 3. Вызываем YandexGPT
        $rawResponse = callYandexGPT($prompt, 0.5, 4000);

        // 4. Парсим JSON
        $cleanJson = '';
        if (preg_match('/\{.*\}/s', $rawResponse, $matches)) {
            $cleanJson = $matches[0];
        }
        $parsed = json_decode($cleanJson, true);

        if (!is_array($parsed)) {
            fail('ИИ вернул некорректный JSON. Попробуйте ещё раз.', 502);
        }

        // 5. Сохраняем
        $db->beginTransaction();
        try {
            $ins = $db->prepare(
                'INSERT INTO leadmagnet_snapshots
                    (launch_id, niche_name, variants, ai_verdict, recommended_idx, source_payload)
                 VALUES (?, ?, ?::jsonb, ?, ?, ?::jsonb)
                 RETURNING id'
            );
            $ins->execute([
                $id,
                (string) ($parsed['niche_name'] ?? $nicheName),
                json_encode($parsed['variants'] ?? [], JSON_UNESCAPED_UNICODE),
                (string) ($parsed['ai_verdict'] ?? ''),
                (int)    ($parsed['recommended_idx'] ?? 0),
                json_encode(['gpt_raw_length' => strlen($rawResponse)], JSON_UNESCAPED_UNICODE),
            ]);
            $snapshotId = (int) $ins->fetchColumn();

            // Обновляем stage
            $db->prepare("UPDATE launches SET stage = 'funnel' WHERE id = ? AND stage IN ('product', 'funnel')")
               ->execute([$id]);

            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            fail('Сбой БД при сохранении лид-магнита: ' . $e->getMessage(), 500);
        }

        // 6. Возвращаем
        $result = [
            'id'              => $snapshotId,
            'niche_name'      => (string) ($parsed['niche_name'] ?? $nicheName),
            'variants'        => $parsed['variants'] ?? [],
            'ai_verdict'      => (string) ($parsed['ai_verdict'] ?? ''),
            'recommended_idx' => (int)    ($parsed['recommended_idx'] ?? 0),
        ];

        json_out($result, 201);
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

/* ================================================================
   Вспомогательные функции
   ================================================================ */

function extractBriefTextLm(PDO $db, int $launchId): string
{
    $b = $db->prepare('SELECT summary FROM briefs WHERE launch_id = ? ORDER BY id DESC LIMIT 1');
    $b->execute([$launchId]);
    $brief = $b->fetch(PDO::FETCH_ASSOC);
    if ($brief && trim($brief['summary'] ?? '') !== '') {
        return trim($brief['summary']);
    }
    $ba = $db->prepare(
        "SELECT ba.label, ba.value FROM brief_answers ba
         JOIN briefs b ON b.id = ba.brief_id
         WHERE b.launch_id = ? AND ba.value != ''
         ORDER BY ba.id"
    );
    $ba->execute([$launchId]);
    $lines = [];
    foreach ($ba->fetchAll(PDO::FETCH_ASSOC) as $a) {
        $lines[] = '- ' . ($a['label'] ?? 'Вопрос') . ': ' . $a['value'];
    }
    return !empty($lines) ? implode("\n", $lines) : 'Описание отсутствует';
}

function buildLeadMagnetPrompt(
    string $briefText,
    string $nicheName,
    array  $segments,
    string $positioning,
    string $usp,
    int    $mainPrice
): string {
    $nl = "\n";

    $segText = '';
    foreach ($segments as $s) {
        $segText .= '  - ' . ($s['title'] ?? 'Сегмент') . ' (' . ($s['share'] ?? 0) . '%): '
            . 'боль: ' . ($s['pain'] ?? '') . ', ценность: ' . ($s['gain'] ?? '') . $nl;
    }

    return 'Ты — ИИ-копирайтер и маркетолог. Создай 3 варианта лид-магнита (A/B/C) для привлечения лидов в воронку онлайн-курса.'
        . $nl . $nl . '--- БРИФ ЭКСПЕРТА ---' . $nl . $briefText
        . $nl . $nl . '--- ДАННЫЕ НИШИ ---' . $nl
        . 'Ниша: ' . $nicheName . $nl
        . 'Сегменты ЦА:' . $nl . ($segText ?: '  нет данных')
        . $nl . $nl . '--- СТРАТЕГИЯ ПРОДУКТА ---' . $nl
        . 'Позиционирование: ' . $positioning . $nl
        . 'УТП: ' . $usp . $nl
        . 'Цена основного курса: ' . $mainPrice . ' руб.' . $nl
        . $nl . $nl . '--- ЗАДАЧА ---' . $nl
        . 'Верни ответ СТРОГО в формате валидного JSON (только JSON, без текста вокруг):' . $nl
        . '{' . $nl
        . '  "niche_name": "' . $nicheName . '",' . $nl
        . '  "variants": [' . $nl
        . '    {' . $nl
        . '      "title": "Заголовок лид-магнита (для лендинга)",' . $nl
        . '      "sub": "Подзаголовок (1 предложение)",' . $nl
        . '      "format": "PDF" или "Квиз" или "Чек-лист" или "Мини-курс",' . $nl
        . '      "bullets": ["Выгода 1", "Выгода 2", "Выгода 3", "Выгода 4"],' . $nl
        . '      "target_segment": "Название сегмента ЦА из данных выше",' . $nl
        . '      "conv": 12.5,' . $nl
        . '      "leads": 800,' . $nl
        . '      "channel": "Лендинг + VK" или "Telegram-бот" или "Директ → квиз"' . $nl
        . '    }' . $nl
        . '  ],' . $nl
        . '  "ai_verdict": "Вердикт ИИ: какой вариант лучше и почему, 2-3 предложения",' . $nl
        . '  "recommended_idx": 2' . $nl
        . '}' . $nl
        . $nl . 'ВНИМАНИЕ:' . $nl
        . '- Ровно 3 варианта (A, B, C), каждый под свой сегмент ЦА.' . $nl
        . '- Варианты должны отличаться форматом (PDF, квиз, чек-лист, мини-курс).' . $nl
        . '- conv — конверсия в лид (%) от 5 до 25, реалистичная для ниши.' . $nl
        . '- leads — прогноз лидов за 12 дней при бюджете 150 000 руб.' . $nl
        . '- channel — канал выдачи, оптимальный для формата.' . $nl
        . '- recommended_idx — индекс лучшего варианта (0, 1 или 2).' . $nl
        . '- ai_verdict — конкретный вердикт: какой вариант выбрать и почему.' . $nl
        . '- Все тексты на русском, конкретные и без воды.' . $nl
        . '- Выведи ТОЛЬКО JSON, больше ни одного слова.';
}