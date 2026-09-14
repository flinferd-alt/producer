<?php

/**
 * launches_tripwire.php — трипваер от ИИ-продюсера.
 *
 * GET  /api/launches/{id}/tripwire — получить текущий трипваер
 * POST /api/launches/{id}/tripwire — сгенерировать новый через YandexGPT
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
            'SELECT id, niche_name, title, desc_text, bullets, price, old_price,
                    conv, oto_available, oto_title, oto_price, oto_conv,
                    ai_verdict, recommendations, created_at
             FROM tripwire_snapshots
             WHERE launch_id = ?
             ORDER BY id DESC LIMIT 1'
        );
        $st->execute([$id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            fail('Трипваер ещё не сгенерирован', 404);
        }

        // Маппим desc_text → desc для фронтенда
        $row['desc']           = $row['desc_text'];
        unset($row['desc_text']);
        $row['bullets']         = json_decode($row['bullets'] ?? '[]', true) ?: [];
        $row['conv']            = (float) ($row['conv'] ?? 4.5);
        $row['oto_conv']        = (float) ($row['oto_conv'] ?? 11.0);
        $row['oto_available']   = (bool) ($row['oto_available'] ?? true);
        $row['recommendations'] = json_decode($row['recommendations'] ?? '[]', true) ?: [];

        json_out($row);
    }

    /* ==================== POST ==================== */
    if ($m === 'POST') {

        // Проверяем, что лид-магнит уже есть
        $launchStmt = $db->prepare('SELECT stage FROM launches WHERE id = ?');
        $launchStmt->execute([$id]);
        $launch = $launchStmt->fetch(PDO::FETCH_ASSOC);
        $stage = $launch['stage'] ?? '';

        if (!in_array($stage, ['product', 'funnel', 'traffic', 'sales'])) {
            fail('Сначала сгенерируйте стратегию продукта', 400);
        }

        // Freemium: перегенерация — только для платных
        $existing = $db->prepare('SELECT id FROM tripwire_snapshots WHERE launch_id = ? LIMIT 1');
        $existing->execute([$id]);
        $hasTw = $existing->fetch(PDO::FETCH_ASSOC) !== false;

        if ($hasTw) {
            $who2 = authenticate();
            $sub2 = $db->prepare('SELECT subscription_status FROM users WHERE id = ?');
            $sub2->execute([$who2['user_id']]);
            $subStatus2 = $sub2->fetchColumn();
            if ($subStatus2 === 'free') {
                fail('Перегенерация трипваера доступна на тарифе «Про»', 402);
            }
        }

        // 1. Собираем контекст
        $briefText = extractBriefTextTw($db, $id);

        // Данные ниши
        $nicheStmt = $db->prepare(
            'SELECT niche_name, avg_check FROM niche_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1'
        );
        $nicheStmt->execute([$id]);
        $niche = $nicheStmt->fetch(PDO::FETCH_ASSOC);
        $nicheName = $niche['niche_name'] ?? 'онлайн-курс';
        $avgCheck  = (int) ($niche['avg_check'] ?? 0);

        // Данные продукта
        $prodStmt = $db->prepare(
            'SELECT positioning, usp, tariffs FROM product_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1'
        );
        $prodStmt->execute([$id]);
        $prod = $prodStmt->fetch(PDO::FETCH_ASSOC);
        $positioning = $prod['positioning'] ?? '';
        $usp         = $prod['usp'] ?? '';

        // Данные лид-магнита (рекомендованный вариант)
        $lmStmt = $db->prepare(
            'SELECT variants, recommended_idx FROM leadmagnet_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1'
        );
        $lmStmt->execute([$id]);
        $lmRow = $lmStmt->fetch(PDO::FETCH_ASSOC);
        $lmVariants = json_decode($lmRow['variants'] ?? '[]', true) ?: [];
        $lmRecIdx   = (int) ($lmRow['recommended_idx'] ?? 0);
        $lmRec      = $lmVariants[$lmRecIdx] ?? null;
        $lmTitle    = $lmRec['title'] ?? 'лид-магнит';
        $lmLeads    = (int) ($lmRec['leads'] ?? 1214);
        $lmConv     = (float) ($lmRec['conv'] ?? 12);

        // 2. Строим промпт
        $prompt = buildTripwirePrompt($briefText, $nicheName, $avgCheck, $positioning, $usp, $lmTitle, $lmLeads, $lmConv);

        // 3. Вызываем YandexGPT
        $rawResponse = callYandexGPT($prompt, 0.5, 3000);

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
                'INSERT INTO tripwire_snapshots
                    (launch_id, niche_name, title, desc_text, bullets,
                     price, old_price, conv, oto_available, oto_title, oto_price, oto_conv,
                     ai_verdict, recommendations, source_payload)
                 VALUES (?, ?, ?, ?, ?::jsonb,
                         ?, ?, ?, ?, ?, ?, ?,
                         ?, ?::jsonb, ?::jsonb)
                 RETURNING id'
            );
            $ins->execute([
                $id,
                (string) ($parsed['niche_name'] ?? $nicheName),
                (string) ($parsed['title'] ?? ''),
                (string) ($parsed['desc'] ?? ''),
                json_encode($parsed['bullets'] ?? [], JSON_UNESCAPED_UNICODE),
                (int)    ($parsed['price'] ?? 990),
                (int)    ($parsed['old_price'] ?? 2900),
                (float)  ($parsed['conv'] ?? 4.5),
                (bool)   ($parsed['oto_available'] ?? true),
                (string) ($parsed['oto_title'] ?? ''),
                (int)    ($parsed['oto_price'] ?? 4900),
                (float)  ($parsed['oto_conv'] ?? 11),
                (string) ($parsed['ai_verdict'] ?? ''),
                json_encode($parsed['recommendations'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode(['gpt_raw_length' => strlen($rawResponse)], JSON_UNESCAPED_UNICODE),
            ]);
            $snapshotId = (int) $ins->fetchColumn();

            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            fail('Сбой БД при сохранении трипваера: ' . $e->getMessage(), 500);
        }

        // 6. Возвращаем (с desc вместо desc_text)
        $result = [
            'id'              => $snapshotId,
            'niche_name'      => (string) ($parsed['niche_name'] ?? $nicheName),
            'title'           => (string) ($parsed['title'] ?? ''),
            'desc'            => (string) ($parsed['desc'] ?? ''),
            'bullets'         => $parsed['bullets'] ?? [],
            'price'           => (int)    ($parsed['price'] ?? 990),
            'old_price'       => (int)    ($parsed['old_price'] ?? 2900),
            'conv'            => (float)  ($parsed['conv'] ?? 4.5),
            'oto_available'   => (bool)   ($parsed['oto_available'] ?? true),
            'oto_title'       => (string) ($parsed['oto_title'] ?? ''),
            'oto_price'       => (int)    ($parsed['oto_price'] ?? 4900),
            'oto_conv'        => (float)  ($parsed['oto_conv'] ?? 11),
            'ai_verdict'      => (string) ($parsed['ai_verdict'] ?? ''),
            'recommendations' => $parsed['recommendations'] ?? [],
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

function extractBriefTextTw(PDO $db, int $launchId): string
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

function buildTripwirePrompt(
    string $briefText,
    string $nicheName,
    int    $avgCheck,
    string $positioning,
    string $usp,
    string $lmTitle,
    int    $lmLeads,
    float  $lmConv
): string {
    $nl = "\n";

    return 'Ты — ИИ-продюсер и маркетолог. Создай трипваер — недорогой продукт (до 1 500 руб.), который превращает подписчика лид-магнита в покупателя и окупает трафик ещё до продажи основного курса.'
        . $nl . $nl . '--- БРИФ ЭКСПЕРТА ---' . $nl . $briefText
        . $nl . $nl . '--- КОНТЕКСТ ---' . $nl
        . 'Ниша: ' . $nicheName . $nl
        . 'Средний чек: ' . $avgCheck . ' руб.' . $nl
        . 'Позиционирование курса: ' . $positioning . $nl
        . 'УТП: ' . $usp . $nl
        . 'Лид-магнит: ' . $lmTitle . $nl
        . 'Прогноз лидов: ' . $lmLeads . ' лидов (конверсия ' . $lmConv . '%)' . $nl
        . $nl . $nl . '--- ЗАДАЧА ---' . $nl
        . 'Верни ответ СТРОГО в формате валидного JSON (только JSON, без текста вокруг):' . $nl
        . '{' . $nl
        . '  "niche_name": "' . $nicheName . '",' . $nl
        . '  "title": "Название трипваера (с кавычками-ёлочками)",' . $nl
        . '  "desc": "Описание, 2-3 предложения",' . $nl
        . '  "bullets": ["Выгода 1", "Выгода 2", "Выгода 3", "Выгода 4"],' . $nl
        . '  "price": 990,' . $nl
        . '  "old_price": 2900,' . $nl
        . '  "conv": 4.5,' . $nl
        . '  "oto_available": true,' . $nl
        . '  "oto_title": "Название OTO-апселла",' . $nl
        . '  "oto_price": 4900,' . $nl
        . '  "oto_conv": 11,' . $nl
        . '  "ai_verdict": "Вердикт ИИ: стоит ли запускать, почему, 2-3 предложения",' . $nl
        . '  "recommendations": ["Рекомендация 1", "Рекомендация 2", "Рекомендация 3"]' . $nl
        . '}' . $nl
        . $nl . 'ВНИМАНИЕ:' . $nl
        . '- price: 490–1490 руб. (импульсная покупка), old_price в 2.5–3 раза выше.' . $nl
        . '- conv: конверсия из лида в покупку трипваера, обычно 3–7%.' . $nl
        . '- oto_available: true если OTO-апселл есть, false если нет.' . $nl
        . '- oto_conv: конверсия покупателя трипваера в OTO, обычно 8–15%.' . $nl
        . '- Трипваер логически связан с лид-магнитом и курсом.' . $nl
        . '- recommendations: 3-4 конкретных совета по запуску трипваера.' . $nl
        . '- Все тексты на русском, конкретные и без воды.' . $nl
        . '- Выведи ТОЛЬКО JSON, больше ни одного слова.';
}