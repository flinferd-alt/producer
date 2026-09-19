<?php

/**
 * launches_funnel.php — воронка продаж от ИИ-продюсера.
 *
 * GET  /api/launches/{id}/funnel — получить текущую воронку
 * POST /api/launches/{id}/funnel — сгенерировать новую через YandexGPT
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
            'SELECT id, niche_name, model, stages, traffic, price,
                    optimized, ai_verdict, recommendations, created_at
             FROM funnel_snapshots
             WHERE launch_id = ?
             ORDER BY id DESC LIMIT 1'
        );
        $st->execute([$id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            fail('Воронка ещё не сгенерирована', 404);
        }

        $row['stages']          = json_decode($row['stages'] ?? '[]', true) ?: [];
        $row['optimized']       = json_decode($row['optimized'] ?? '{}', true) ?: (object)[];
        $row['recommendations'] = json_decode($row['recommendations'] ?? '[]', true) ?: [];
        $row['traffic']         = (int) $row['traffic'];
        $row['price']           = (int) $row['price'];

        json_out($row);
    }

    /* ==================== POST ==================== */
    if ($m === 'POST') {

        // Воронка доступна после трипваера (stage = funnel или дальше)
        $launchStmt = $db->prepare('SELECT stage FROM launches WHERE id = ?');
        $launchStmt->execute([$id]);
        $launch = $launchStmt->fetch(PDO::FETCH_ASSOC);
        $stage = $launch['stage'] ?? '';

        if (!in_array($stage, ['funnel', 'traffic', 'sales'])) {
            fail('Сначала сгенерируйте трипваер', 400);
        }

        // Freemium: перегенерация — только для платных
        $existing = $db->prepare('SELECT id FROM funnel_snapshots WHERE launch_id = ? LIMIT 1');
        $existing->execute([$id]);
        $hasFn = $existing->fetch(PDO::FETCH_ASSOC) !== false;

        if ($hasFn) {
            $who2 = authenticate();
            $sub2 = $db->prepare('SELECT subscription_status FROM users WHERE id = ?');
            $sub2->execute([$who2['user_id']]);
            $subStatus2 = $sub2->fetchColumn();
            if ($subStatus2 === 'free') {
                fail('Перегенерация воронки доступна на тарифе «Про»', 402);
            }
        }

        // 1. Собираем контекст: бриф
        $briefText = extractBriefTextFn($db, $id);

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
            'SELECT positioning, usp FROM product_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1'
        );
        $prodStmt->execute([$id]);
        $prod = $prodStmt->fetch(PDO::FETCH_ASSOC);
        $positioning = $prod['positioning'] ?? '';
        $usp         = $prod['usp'] ?? '';

        // Данные трипваера
        $twStmt = $db->prepare(
            'SELECT title, price, conv, oto_available FROM tripwire_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1'
        );
        $twStmt->execute([$id]);
        $tw = $twStmt->fetch(PDO::FETCH_ASSOC);
        $twTitle = $tw['title'] ?? 'трипваер';
        $twPrice = (int) ($tw['price'] ?? 990);
        $twConv  = (float) ($tw['conv'] ?? 4.5);

        // 2. Строим промпт
        $prompt = buildFunnelPrompt($briefText, $nicheName, $avgCheck, $positioning, $usp, $twTitle, $twPrice, $twConv);

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

        // 5. Нормализуем этапы воронки
        $stages = normalizeFunnelStages($parsed['stages'] ?? [], $parsed['optimized'] ?? []);

        // 6. Сохраняем
        $db->beginTransaction();
        try {
            $ins = $db->prepare(
                'INSERT INTO funnel_snapshots
                    (launch_id, niche_name, model, stages, traffic, price,
                     optimized, ai_verdict, recommendations, source_payload)
                 VALUES (?, ?, ?, ?::jsonb, ?, ?,
                         ?::jsonb, ?, ?::jsonb, ?::jsonb)
                 RETURNING id'
            );
            $ins->execute([
                $id,
                (string) ($parsed['niche_name'] ?? $nicheName),
                (string) ($parsed['model'] ?? 'webinar'),
                json_encode($stages, JSON_UNESCAPED_UNICODE),
                (int)    ($parsed['traffic'] ?? 12000),
                (int)    ($parsed['price'] ?? $avgCheck),
                json_encode($parsed['optimized'] ?? new stdClass(), JSON_UNESCAPED_UNICODE),
                (string) ($parsed['ai_verdict'] ?? ''),
                json_encode($parsed['recommendations'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode(['gpt_raw_length' => strlen($rawResponse)], JSON_UNESCAPED_UNICODE),
            ]);
            $snapshotId = (int) $ins->fetchColumn();

            // Воронка сгенерирована — переводим запуск на этап трафика
            $db->prepare("UPDATE launches SET stage = 'traffic' WHERE id = ? AND stage IN ('funnel')")
               ->execute([$id]);

            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            fail('Сбой БД при сохранении воронки: ' . $e->getMessage(), 500);
        }

        // 7. Возвращаем
        $result = [
            'id'              => $snapshotId,
            'niche_name'      => (string) ($parsed['niche_name'] ?? $nicheName),
            'model'           => (string) ($parsed['model'] ?? 'webinar'),
            'stages'          => $stages,
            'traffic'         => (int) ($parsed['traffic'] ?? 12000),
            'price'           => (int) ($parsed['price'] ?? $avgCheck),
            'optimized'       => $parsed['optimized'] ?? (object)[],
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

function extractBriefTextFn(PDO $db, int $launchId): string
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

/**
 * Нормализует этапы воронки: строго 5 известных id, числа float,
 * конверсии в разумных диапазонах, бенчмарки и советы обязательны.
 */
function normalizeFunnelStages(array $rawStages, array|object $rawOptimized): array
{
    $known = [
        'reg'   => ['label' => 'Клик → регистрация на вебинар', 'min' => 1, 'max' => 25],
        'show'  => ['label' => 'Регистрация → пришли на эфир',  'min' => 10, 'max' => 90],
        'stay'  => ['label' => 'Эфир → досмотрели до оффера',   'min' => 10, 'max' => 95],
        'buy'   => ['label' => 'Досмотрели → купили курс',      'min' => 1, 'max' => 20],
        'trip'  => ['label' => 'Не купили → взяли трипваер',    'min' => 1, 'max' => 20],
    ];
    $optArr = is_object($rawOptimized) ? (array) $rawOptimized : $rawOptimized;

    $byId = [];
    foreach ((is_array($rawStages) ? $rawStages : []) as $s) {
        if (is_array($s) && isset($s['id'])) {
            $byId[(string) $s['id']] = $s;
        }
    }

    $out = [];
    foreach ($known as $sid => $meta) {
        $s = $byId[$sid] ?? [];
        $value = (float) ($s['value'] ?? 0);
        if ($value < $meta['min']) {
            $value = $meta['min'];
        }
        if ($value > $meta['max']) {
            $value = $meta['max'];
        }
        $optVal = (float) ($optArr[$sid] ?? 0);
        if ($optVal > 0 && ($optVal < $meta['min'] || $optVal > $meta['max'])) {
            $optVal = $value;
        }
        $out[] = [
            'id'     => $sid,
            'label'  => $meta['label'],
            'value'  => round($value, 1),
            'bench'  => (float) ($s['bench'] ?? $value),
            'tip'    => (string) ($s['tip'] ?? ''),
            'opt'    => $optVal > 0 ? round($optVal, 1) : round($value, 1),
        ];
    }
    return $out;
}

function buildFunnelPrompt(
    string $briefText,
    string $nicheName,
    int    $avgCheck,
    string $positioning,
    string $usp,
    string $twTitle,
    int    $twPrice,
    float  $twConv
): string {
    $nl = "\n";

    return 'Ты — ИИ-продюсер и эксперт по воронкам продаж онлайн-курсов. Спроектируй вебинарную воронку запуска с реалистичными конверсиями на основе бенчмарков ниши.'
        . $nl . $nl . '--- БРИФ ЭКСПЕРТА ---' . $nl . $briefText
        . $nl . $nl . '--- КОНТЕКСТ ---' . $nl
        . 'Ниша: ' . $nicheName . $nl
        . 'Средний чек курса: ' . $avgCheck . ' руб.' . $nl
        . 'Позиционирование курса: ' . $positioning . $nl
        . 'УТП: ' . $usp . $nl
        . 'Трипваер: «' . $twTitle . '» за ' . $twPrice . ' руб., конверсия из лида ' . $twConv . '%' . $nl
        . $nl . $nl . '--- ЗАДАЧА ---' . $nl
        . 'Верни ответ СТРОГО в формате валидного JSON (только JSON, без текста вокруг):' . $nl
        . '{' . $nl
        . '  "niche_name": "' . $nicheName . '",' . $nl
        . '  "model": "webinar",' . $nl
        . '  "stages": [' . $nl
        . '    {"id": "reg", "label": "Клик → регистрация на вебинар", "value": 8.5, "bench": 7.0, "tip": "Короткий совет по поднятию конверсии, 1 предложение"},' . $nl
        . '    {"id": "show", "label": "Регистрация → пришли на эфир", "value": 45, "bench": 42, "tip": "..."},' . $nl
        . '    {"id": "stay", "label": "Эфир → досмотрели до оффера", "value": 60, "bench": 55, "tip": "..."},' . $nl
        . '    {"id": "buy", "label": "Досмотрели → купили курс", "value": 6.5, "bench": 5.2, "tip": "..."},' . $nl
        . '    {"id": "trip", "label": "Не купили → взяли трипваер", "value": 4.5, "bench": 3.5, "tip": "..."}' . $nl
        . '  ],' . $nl
        . '  "traffic": 12000,' . $nl
        . '  "price": ' . ($avgCheck > 0 ? $avgCheck : 24900) . ',' . $nl
        . '  "optimized": {"reg": 9.8, "show": 51, "stay": 64, "buy": 7.4, "trip": 5.6},' . $nl
        . '  "ai_verdict": "Вердикт ИИ: реалистичен ли прогноз выручки при таком бюджете, 2-3 предложения",' . $nl
        . '  "recommendations": ["Рекомендация 1", "Рекомендация 2", "Рекомендация 3"]' . $nl
        . '}' . $nl
        . $nl . 'ВНИМАНИЕ:' . $nl
        . '- value: прогнозная конверсия с учётом ниши, bench: эталон ниши (bench может быть ниже value).' . $nl
        . '- optimized: оптимистичные, но достижимые значения после работы над точками роста из tip.' . $nl
        . '- traffic: сколько кликов по рекламе планируем на запуск (5 000–40 000).' . $nl
        . '- tips: конкретные, без воды, привязаны к нише.' . $nl
        . '- recommendations: 3-4 совета по запуску воронки.' . $nl
        . '- Все тексты на русском.' . $nl
        . '- Выведи ТОЛЬКО JSON, больше ни одного слова.';
}