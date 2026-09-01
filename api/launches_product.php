<?php

/**
 * launches_product.php — стратегия продукта от ИИ-продюсера.
 *
 * GET  /api/launches/{id}/product — получить текущую стратегию
 * POST /api/launches/{id}/product — сгенерировать новую стратегию через YandexGPT
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
            'SELECT id, niche_name, positioning, usp, competitor_diff,
                    modules, tariffs, unit_economics, methodology, risks,
                    recommendations, created_at
             FROM product_snapshots
             WHERE launch_id = ?
             ORDER BY id DESC LIMIT 1'
        );
        $st->execute([$id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            fail('Стратегия продукта ещё не сгенерирована', 404);
        }

        // Парсим JSONB поля
        $row['modules']         = json_decode($row['modules'] ?? '[]', true) ?: [];
        $row['tariffs']         = json_decode($row['tariffs'] ?? '[]', true) ?: [];
        $row['unit_economics']  = json_decode($row['unit_economics'] ?? '{}', true) ?: [];
        $row['methodology']     = json_decode($row['methodology'] ?? '{}', true) ?: [];
        $row['risks']           = json_decode($row['risks'] ?? '[]', true) ?: [];
        $row['recommendations'] = json_decode($row['recommendations'] ?? '[]', true) ?: [];

        json_out($row);
    }

    /* ==================== POST ==================== */
    if ($m === 'POST') {

        // Проверяем, что ниша уже принята
        $launchStmt = $db->prepare('SELECT stage FROM launches WHERE id = ?');
        $launchStmt->execute([$id]);
        $launch = $launchStmt->fetch(PDO::FETCH_ASSOC);
        $stage = $launch['stage'] ?? '';

        if (!in_array($stage, ['niche_accepted', 'product', 'funnel', 'traffic', 'sales'])) {
            fail('Сначала примите стратегию ниши, прежде чем генерировать продукт', 400);
        }

        // Freemium: перегенерация — только для платных
        $existing = $db->prepare('SELECT id FROM product_snapshots WHERE launch_id = ? LIMIT 1');
        $existing->execute([$id]);
        $hasProduct = $existing->fetch(PDO::FETCH_ASSOC) !== false;

        if ($hasProduct) {
            $who2 = authenticate();
            $sub2 = $db->prepare('SELECT subscription_status FROM users WHERE id = ?');
            $sub2->execute([$who2['user_id']]);
            $subStatus2 = $sub2->fetchColumn();
            if ($subStatus2 === 'free') {
                fail('Перегенерация стратегии продукта доступна на тарифе «Про»', 402);
            }
        }

        // 1. Собираем контекст из брифа и ниши
        $briefText = extractBriefText($db, $id);

        // Данные ниши
        $nicheStmt = $db->prepare(
            'SELECT niche_name, verdict, avg_check, margin, cpc, demand, score, segments, swot
             FROM niche_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1'
        );
        $nicheStmt->execute([$id]);
        $niche = $nicheStmt->fetch(PDO::FETCH_ASSOC);

        $nicheName = $niche['niche_name'] ?? 'онлайн-курс';
        $avgCheck  = (int) ($niche['avg_check'] ?? 0);
        $margin    = (int) ($niche['margin'] ?? 0);
        $cpc       = (int) ($niche['cpc'] ?? 0);
        $demand    = (int) ($niche['demand'] ?? 0);
        $score     = (int) ($niche['score'] ?? 0);
        $segments  = json_decode($niche['segments'] ?? '[]', true) ?: [];
        $swot      = json_decode($niche['swot'] ?? '[]', true) ?: [];

        // Конкуренты
        $compStmt = $db->prepare(
            'SELECT name, weak, power FROM competitors c
             JOIN niche_snapshots n ON n.id = c.snapshot_id
             WHERE n.launch_id = ? ORDER BY c.power DESC LIMIT 5'
        );
        $compStmt->execute([$id]);
        $competitors = $compStmt->fetchAll(PDO::FETCH_ASSOC);

        // 2. Строим промпт для YandexGPT
        $prompt = buildProductPrompt($briefText, $nicheName, $avgCheck, $margin, $cpc, $demand, $score, $segments, $swot, $competitors);

        // 3. Вызываем YandexGPT
        $rawResponse = callYandexGPT($prompt, 0.4, 4000);

        // 4. Парсим JSON из ответа
        $cleanJson = '';
        if (preg_match('/\{.*\}/s', $rawResponse, $matches)) {
            $cleanJson = $matches[0];
        }
        $parsed = json_decode($cleanJson, true);

        if (!is_array($parsed)) {
            fail('ИИ вернул некорректный JSON. Попробуйте ещё раз.', 502);
        }

        // 5. Сохраняем в БД
        $db->beginTransaction();
        try {
            $ins = $db->prepare(
                'INSERT INTO product_snapshots
                    (launch_id, niche_name, positioning, usp, competitor_diff,
                     modules, tariffs, unit_economics, methodology, risks, recommendations, source_payload)
                 VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb)
                 RETURNING id'
            );
            $ins->execute([
                $id,
                (string) ($parsed['niche_name'] ?? $nicheName),
                (string) ($parsed['positioning'] ?? ''),
                (string) ($parsed['usp'] ?? ''),
                (string) ($parsed['competitor_diff'] ?? ''),
                json_encode($parsed['modules'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode($parsed['tariffs'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode($parsed['unit_economics'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode($parsed['methodology'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode($parsed['risks'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode($parsed['recommendations'] ?? [], JSON_UNESCAPED_UNICODE),
                json_encode(['gpt_raw_length' => strlen($rawResponse)], JSON_UNESCAPED_UNICODE),
            ]);
            $snapshotId = (int) $ins->fetchColumn();

            // Обновляем stage запуска
            $db->prepare("UPDATE launches SET stage = 'product' WHERE id = ? AND stage IN ('niche_accepted', 'product')")
               ->execute([$id]);

            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            fail('Сбой БД при сохранении стратегии: ' . $e->getMessage(), 500);
        }

        // 6. Возвращаем результат
        $result = [
            'id'               => $snapshotId,
            'niche_name'       => (string) ($parsed['niche_name'] ?? $nicheName),
            'positioning'      => (string) ($parsed['positioning'] ?? ''),
            'usp'              => (string) ($parsed['usp'] ?? ''),
            'competitor_diff'  => (string) ($parsed['competitor_diff'] ?? ''),
            'modules'          => $parsed['modules'] ?? [],
            'tariffs'          => $parsed['tariffs'] ?? [],
            'unit_economics'   => $parsed['unit_economics'] ?? [],
            'methodology'      => $parsed['methodology'] ?? [],
            'risks'            => $parsed['risks'] ?? [],
            'recommendations'  => $parsed['recommendations'] ?? [],
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

/**
 * Извлекает текст брифа.
 */
function extractBriefText(PDO $db, int $launchId): string
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
 * Строит промпт для YandexGPT — стратегия продукта.
 */
function buildProductPrompt(
    string $briefText,
    string $nicheName,
    int $avgCheck,
    int $margin,
    int $cpc,
    int $demand,
    int $score,
    array $segments,
    array $swot,
    array $competitors
): string {
    $nl = "\n";

    // Сегменты ЦА
    $segText = '';
    foreach ($segments as $s) {
        $segText .= '  - ' . ($s['title'] ?? 'Сегмент') . ' (' . ($s['share'] ?? 0) . '%): '
            . 'боль: ' . ($s['pain'] ?? '') . ', ценность: ' . ($s['gain'] ?? '') . $nl;
    }

    // Конкуренты
    $compText = '';
    foreach ($competitors as $c) {
        $compText .= '  - ' . ($c['name'] ?? '') . ': уязвимость — ' . ($c['weak'] ?? '') . $nl;
    }

    $prompt = 'Ты — ИИ-продюсер, маркетолог и методолог онлайн-курсов. Создай полную стратегию продукта на основе данных ниже.'
        . $nl . $nl . '--- БРИФ ЭКСПЕРТА ---' . $nl . $briefText
        . $nl . $nl . '--- ДАННЫЕ НИШИ ---' . $nl
        . 'Ниша: ' . $nicheName . $nl
        . 'Средний чек: ' . $avgCheck . ' руб.' . $nl
        . 'Маржа: ' . $margin . '%' . $nl
        . 'CPC: ' . $cpc . ' руб.' . $nl
        . 'Спрос: ' . $demand . ' показов/мес' . $nl
        . 'Скор ниши: ' . $score . '/100' . $nl
        . $nl . 'Сегменты ЦА:' . $nl . ($segText ?: '  нет данных')
        . $nl . 'Конкуренты:' . $nl . ($compText ?: '  нет данных')
        . $nl . $nl . '--- ЗАДАЧА ---' . $nl
        . 'Верни ответ СТРОГО в формате валидного JSON (только JSON, без текста вокруг):' . $nl
        . '{' . $nl
        . '  "niche_name": "' . $nicheName . '",' . $nl
        . '  "positioning": "Позиционирование курса, 1-2 предложения",' . $nl
        . '  "usp": "Уникальное торговое предложение, 1 предложение",' . $nl
        . '  "competitor_diff": "Отстройка от конкурентов, 1-2 предложения",' . $nl
        . '  "modules": [' . $nl
        . '    {"title": "Название модуля", "lessons": ["Урок 1", "Урок 2", "Урок 3"]}' . $nl
        . '  ],' . $nl
        . '  "tariffs": [' . $nl
        . '    {"name": "Старт", "price": 9900, "note": "Базовый", "features": ["фича 1", "фича 2"]},' . $nl
        . '    {"name": "Основной", "price": ' . $avgCheck . ', "hot": true, "note": "Оптимальный", "features": ["фича 1", "фича 2", "фича 3"]},' . $nl
        . '    {"name": "Премиум", "price": ' . ($avgCheck * 2) . ', "note": "С поддержкой", "features": ["фича 1", "фича 2", "фича 3", "фича 4"]}' . $nl
        . '  ],' . $nl
        . '  "unit_economics": {' . $nl
        . '    "cac": ' . $cpc . ',' . $nl
        . '    "ltv": ' . $avgCheck . ',' . $nl
        . '    "romi": ' . (int)(($avgCheck - $cpc) / max(1, $cpc) * 100) . ',' . $nl
        . '    "break_even": ' . max(1, (int)ceil(150000 / max(1, $avgCheck))) . $nl
        . '  },' . $nl
        . '  "methodology": {' . $nl
        . '    "format": "Формат обучения",' . $nl
        . '    "frequency": "Частота занятий",' . $nl
        . '    "feedback": "Система обратной связи",' . $nl
        . '    "certificate": "Сертификация и портфолио"' . $nl
        . '  },' . $nl
        . '  "risks": [' . $nl
        . '    {"title": "Название риска", "severity": "high|medium|low", "mitigation": "Решение"}' . $nl
        . '  ],' . $nl
        . '  "recommendations": [' . $nl
        . '    "Рекомендация 1",' . $nl
        . '    "Рекомендация 2"' . $nl
        . '  ]' . $nl
        . '}' . $nl
        . $nl . 'ВНИМАНИЕ:' . $nl
        . '- Модулей: 5-7, в каждом 2-4 урока.' . $nl
        . '- Тарифов: 3, у среднего указывай "hot": true.' . $nl
        . '- Рисков: 3-5, severity только "high", "medium" или "low".' . $nl
        . '- Рекомендаций: 3-5 конкретных советов.' . $nl
        . '- Все тексты на русском, конкретные и без воды.' . $nl
        . '- Цены реалистичные для ниши РФ.' . $nl
        . '- Выведи ТОЛЬКО JSON, больше ни одного слова.';

    return $prompt;
}