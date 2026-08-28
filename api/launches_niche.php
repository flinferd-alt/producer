"<?php

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
    require_once __DIR__ . '/search_api.php';

    cors();
    authenticate();
    $m  = method('GET', 'POST');
    $id = launchId();

    $db = db();

    $chk = $db->prepare('SELECT id FROM launches WHERE id = ?');
    $chk->execute([$id]);
    if ($chk->fetch(PDO::FETCH_ASSOC) === false) {
        fail('Запуск не найден', 404);
    }

    /* ==================== GET ==================== */
    if ($m === 'GET') {
        $n = $db->prepare(
            'SELECT id, score, niche_name, verdict, demand, demand_growth, avg_check, margin, cpc,
                    demand_source, competitors_source, source_payload, search_checked_at, created_at
             FROM niche_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1'
        );
        $n->execute([$id]);
        $row = $n->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            fail('Анализ ниши ещё не сохранялся', 404);
        }

        $c = $db->prepare(
            'SELECT name, students, price_check as check, rating, weak, power
             FROM competitors WHERE snapshot_id = ? ORDER BY power DESC'
        );
        $c->execute([(int) $row['id']]);

        $kw = $db->prepare(
            'SELECT phrase, count, is_main FROM wordstat_keywords WHERE snapshot_id = ? ORDER BY count DESC LIMIT 50'
        );
        $kw->execute([(int) $row['id']]);

        $row['competitors']     = $c->fetchAll(PDO::FETCH_ASSOC);
        $row['wordstat_top']    = $kw->fetchAll(PDO::FETCH_ASSOC);

        json_out($row);
    }

    /* ==================== POST ==================== */
    if ($m === 'POST') {

        // 1. Извлекаем ключевую фразу ниши из брифа
        $nichePhrase = extractNichePhrase($db, $id);

        // 2. Источники данных (по умолчанию ai_estimate)
        $demandSource      = 'ai_estimate';
        $competitorsSource = 'ai_estimate';
        $sourcePayload     = [];

        // 3. Wordstat: реальный спрос из Search API
        $wordstatTop = null;
        try {
            $wordstatTop = searchApiWordstatTop($nichePhrase, 100);
            $demandSource = 'wordstat';
            $sourcePayload['wordstat_query'] = $nichePhrase;
            $sourcePayload['wordstat_total'] = $wordstatTop['totalCount'];
        } catch (Throwable $e) {
            $sourcePayload['wordstat_error'] = $e->getMessage();
        }

        // 4. Конкуренты: веб-поиск через Search API
        $searchDocs = [];
        try {
            $searchQuery = $nichePhrase . ' курс обучение школа';
            $searchDocs  = searchApiWebDocs($searchQuery, 10);
            if (!empty($searchDocs)) {
                $competitorsSource = 'search';
                $sourcePayload['search_query'] = $searchQuery;
                $sourcePayload['search_docs_count'] = count($searchDocs);
            }
        } catch (Throwable $e) {
            $sourcePayload['search_error'] = $e->getMessage();
        }

        // 5. Считаем demand из Wordstat
        $demand      = 0;
        $demandGrowth = 0;
        if ($wordstatTop !== null) {
            $demand = $wordstatTop['totalCount'];
            // demand_growth пока 0 — потребуется GetDynamics для тренда
        }

        // 6. YandexGPT: анализирует реальные данные, НЕ фабрикует цифры
        $score     = 0;
        $nicheName = $nichePhrase;
        $verdict   = '';
        $avgCheck  = 0;
        $margin    = 0;
        $cpc       = 0;
        $competitors = [];

        $briefText = extractBriefText($db, $id);

        try {
            $prompt = buildNicheAnalysisPrompt($briefText, $nichePhrase, $wordstatTop, $searchDocs);
            $rawResponse = callYandexGPT($prompt, 0.3, 3000);

            // Парсим JSON от YandexGPT
            $cleanJson = '';
            if (preg_match('/\\{.*\\}/s', $rawResponse, $matches)) {
                $cleanJson = $matches[0];
            }
            $parsed = json_decode($cleanJson, true);

            if (is_array($parsed) && isset($parsed['score'])) {
                $score     = (int) ($parsed['score'] ?? 0);
                $nicheName = (string) ($parsed['niche_name'] ?? $nichePhrase);
                $verdict   = (string) ($parsed['verdict'] ?? '');
                $avgCheck  = (int) ($parsed['avg_check'] ?? 0);
                $margin    = (int) ($parsed['margin'] ?? 0);
                $cpc       = (int) ($parsed['cpc'] ?? 0);
                $competitors = (array) ($parsed['competitors'] ?? []);
            } else {
                $sourcePayload['gpt_parse_error'] = json_last_error_msg();
                $sourcePayload['gpt_raw_preview'] = mb_substr($rawResponse, 0, 300);
            }
        } catch (Throwable $e) {
            $sourcePayload['gpt_error'] = $e->getMessage();
            $score   = 0;
            $verdict = 'Ошибка ИИ-анализа: ' . $e->getMessage();
        }

        // 7. Сохраняем в БД
        $db->beginTransaction();
        try {
            $st = $db->prepare(
                'INSERT INTO niche_snapshots
                    (launch_id, score, niche_name, verdict, demand, demand_growth,
                     avg_check, margin, cpc, demand_source, competitors_source,
                     source_payload, search_checked_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, now())
                 RETURNING id'
            );
            $st->execute([
                $id, $score, $nicheName, $verdict,
                $demand, $demandGrowth, $avgCheck, $margin, $cpc,
                $demandSource, $competitorsSource,
                json_encode($sourcePayload, JSON_UNESCAPED_UNICODE),
            ]);
            $snapshotId = (int) $st->fetchColumn();

            // Конкуренты
            $ins = $db->prepare(
                'INSERT INTO competitors (snapshot_id, name, students, price_check, rating, weak, power)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($competitors as $c) {
                if (is_array($c)) {
                    $ins->execute([
                        $snapshotId,
                        (string) ($c['name'] ?? ''),
                        (int) ($c['students'] ?? 0),
                        (int) ($c['check'] ?? 0),
                        (float) ($c['rating'] ?? 0),
                        (string) ($c['weak'] ?? ''),
                        (int) ($c['power'] ?? 0),
                    ]);
                }
            }

            // Топ-фразы Wordstat
            if ($wordstatTop !== null && !empty($wordstatTop['results'])) {
                $kwIns = $db->prepare(
                    'INSERT INTO wordstat_keywords (launch_id, snapshot_id, phrase, count, is_main)
                     VALUES (?, ?, ?, ?, ?)'
                );
                foreach ($wordstatTop['results'] as $i => $kw) {
                    $kwIns->execute([
                        $id, $snapshotId,
                        (string) ($kw['phrase'] ?? ''),
                        (int) ($kw['count'] ?? 0),
                        ($i === 0),
                    ]);
                }
            }

            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            fail('Сбой БД при сохранении: ' . $e->getMessage(), 500);
        }

        json_out(['snapshot_id' => $snapshotId], 201);
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
 * Извлекает ключевую фразу ниши из brief_answers.
 * Сначала ищет ответ с key='niche', затем по лейблу.
 * Фолбэк — название запуска.
 */
function extractNichePhrase(PDO $db, int $launchId): string
{
    // Пытаемся взять из brief_answers -> key = 'niche'
    $ba = $db->prepare(
        'SELECT ba.value FROM brief_answers ba
         JOIN briefs b ON b.id = ba.brief_id
         WHERE b.launch_id = ? AND ba.key = ? AND ba.value != \'\'
         ORDER BY b.id DESC LIMIT 1'
    );
    $ba->execute([$launchId, 'niche']);
    $row = $ba->fetch(PDO::FETCH_ASSOC);
    if ($row && trim($row['value']) !== '') {
        return trim($row['value']);
    }

    // Фолбэк: название запуска
    $ln = $db->prepare('SELECT name FROM launches WHERE id = ?');
    $ln->execute([$launchId]);
    $launch = $ln->fetch(PDO::FETCH_ASSOC);
    if ($launch && trim($launch['name']) !== '') {
        return trim($launch['name']);
    }

    return 'онлайн-курс';
}

/**
 * Извлекает текст брифа для промпта YandexGPT.
 */
function extractBriefText(PDO $db, int $launchId): string
{
    $b = $db->prepare('SELECT summary FROM briefs WHERE launch_id = ? ORDER BY id DESC LIMIT 1');
    $b->execute([$launchId]);
    $brief = $b->fetch(PDO::FETCH_ASSOC);

    if ($brief && trim($brief['summary'] ?? '') !== '') {
        return trim($brief['summary']);
    }

    // Если summary нет, собираем из ответов
    $ba = $db->prepare(
        'SELECT ba.label, ba.value FROM brief_answers ba
         JOIN briefs b ON b.id = ba.brief_id
         WHERE b.launch_id = ? AND ba.value != \'\'
         ORDER BY ba.id'
    );
    $ba->execute([$launchId]);
    $lines = [];
    foreach ($ba->fetchAll(PDO::FETCH_ASSOC) as $a) {
        $lines[] = '- ' . ($a['label'] ?? 'Вопрос') . ': ' . $a['value'];
    }

    return !empty($lines) ? implode(\"\\n\", $lines) : 'Описание ниши отсутствует';
}

/**
 * Строит промпт для YandexGPT на основе реальных данных.
 *
 * Важно: нейросеть анализирует, а не фабрикует.
 * demand берётся из Wordstat (уже посчитан), а не придумывается.
 * Конкуренты выявляются на основе сниппетов поиска.
 */
function buildNicheAnalysisPrompt(
    string $briefText,
    string $nichePhrase,
    ?array $wordstatTop,
    array $searchDocs
): string {
    $wordstatSection = '';
    if ($wordstatTop !== null) {
        $topPhrases = '';
        $limit = 20;
        foreach ($wordstatTop['results'] as $i => $r) {
            if ($i >= $limit) break;
            $topPhrases .= '  - ' . $r['phrase'] . ': ' . number_format($r['count'], 0, '', ' ') . ' показов/мес' . \"\\n\";
        }
        $wordstatSection = \"\\n\\n--- ДАННЫЕ WORDSTAT (реальные) ---\\n\"
            . 'Суммарный спрос по фразе \"' . $nichePhrase . '\": '
            . number_format($wordstatTop['totalCount'], 0, '', ' ') . ' показов/мес' . \"\\n\"
            . 'Топ фраз:\\n' . $topPhrases;
    } else {
        $wordstatSection = \"\\n\\n--- ДАННЫЕ WORDSTAT ---\\nНедоступны. Оцени спрос примерно, но укажи в verdict, что спрос не подтверждён Wordstat.\";
    }

    $searchSection = '';
    if (!empty($searchDocs)) {
        $searchSection = \"\\n\\n--- РЕЗУЛЬТАТЫ ПОИСКА КОНКУРЕНТОВ ---\\n\";
        foreach ($searchDocs as $i => $doc) {
            $searchSection .= ($i + 1) . '. [' . ($doc['title'] ?? 'Без заголовка') . '](' . ($doc['url'] ?? '') . \")\\n\"
                . '   Сниппет: ' . ($doc['snippet'] ?? 'нет') . \"\\n\";
        }
        $searchSection .= \"\\nНа основе этих сниппетов определи до 5 конкурентов (школ/курсов) в нише.\";
    } else {
        $searchSection = \"\\n\\n--- РЕЗУЛЬТАТЫ ПОИСКА КОНКУРЕНТОВ ---\\nНедоступны. Опиши конкурентов на основе брифа, но укажи, что данные не подтверждены поиском.\";
    }

    return 'Ты — ИИ-продюсер онлайн-курсов и аналитик рынка РФ. Проанализируй нишу на основе реальных данных ниже.'
        . \"\\n\\n--- БРИФ ЭКСПЕРТА ---\\n\" . $briefText
        . $wordstatSection
        . $searchSection
        . \"\\n\\n--- ЗАДАЧА ---\\n\"
        . 'Верни ответ СТРОГО в формате валидного JSON (только JSON, без текста вокруг):' . \"\\n\"
        . \"{\\n\"
        . '  \"score\": число от 1 до 100 (оценка привлекательности ниши на основе данных),' . \"\\n\"
        . '  \"niche_name\": \"Краткое название ниши\"' . \"\\n\"
        . '  \"verdict\": \"Стратегический вывод: заходить или нет, 2-3 предложения на основе данных выше\"' . \"\\n\"
        . '  \"avg_check\": реалистичный средний чек курса в рублях (число)' . \"\\n\"
        . '  \"margin\": процент маржинальности от 30 до 85 (число)' . \"\\n\"
        . '  \"cpc\": прогноз стоимости клика в Директе в рублях (число)' . \"\\n\"
        . '  \"competitors\": [' . \"\\n\"
        . '    {' . \"\\n\"
        . '      \"name\": \"Название школы/курса из сниппетов поиска\"' . \"\\n\"
        . '      \"students\": 0 (если нет точных данных — ставь 0, не придумывай)' . \"\\n\"
        . '      \"check\": 0 (если нет точных данных — ставь 0, не придумывай)' . \"\\n\"
        . '      \"rating\": 0 (если нет точных данных — ставь 0)' . \"\\n\"
        . '      \"weak\": \"Слабое место, выявленное из сниппета или брифа\"' . \"\\n\"
        . '      \"power\": число от 10 до 95 (оценка силы конкурента)' . \"\\n\"
        . '    }' . \"\\n\"
        . '  ]' . \"\\n\"
        . \"}\\n\"
        . \"\\nВНИМАНИЕ:\\n\"
        . '- demand (спрос) НЕ придумывай — он уже посчитан из Wordstat и сохранён отдельно.' . \"\\n\"
        . '- Если в сниппетах нет данных о числе учеников или чеке конкурента — ставь 0.' . \"\\n\"
        . '- Конкурентов определяй ТОЛЬКО на основе найденных сниппетов, не выдумывай несуществующие школы.' . \"\\n\"
        . '- Выведи ТОЛЬКО JSON, больше ни одного слова.';
}"