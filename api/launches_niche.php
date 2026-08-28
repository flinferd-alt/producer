<?php

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

        $row['competitors']  = $c->fetchAll(PDO::FETCH_ASSOC);
        $row['wordstat_top'] = $kw->fetchAll(PDO::FETCH_ASSOC);

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

        // 3. Умный Wordstat: каскадный подбор фраз
        $wordstatTop    = null;
        $bestPhrase     = $nichePhrase;
        $allWordstatKws = []; // все фразы из всех запросов

        try {
            $result = smartWordstatQuery($nichePhrase, $briefText ?? null);
            $wordstatTop    = $result['top'];
            $bestPhrase     = $result['bestPhrase'];
            $allWordstatKws = $result['allKeywords'];
            $demandSource   = 'wordstat';
            $sourcePayload['wordstat_best_phrase'] = $bestPhrase;
            $sourcePayload['wordstat_total']       = $wordstatTop['totalCount'];
            $sourcePayload['wordstat_queries']      = $result['queriesTried'];
        } catch (Throwable $e) {
            $sourcePayload['wordstat_error'] = $e->getMessage();
        }
        // 4. Конкуренты: веб-поиск через Search API
        $searchDocs = [];
        $compCount  = 0;
        try {
            $searchQuery = $bestPhrase . ' курс обучение школа';
            $searchDocs  = searchApiWebDocs($searchQuery, 10);
            if (!empty($searchDocs)) {
                $competitorsSource = 'search';
                $sourcePayload['search_query']      = $searchQuery;
                $sourcePayload['search_docs_count'] = count($searchDocs);
                $compCount = count($searchDocs);
            }
        } catch (Throwable $e) {
            $sourcePayload['search_error'] = $e->getMessage();
        }

        // 5. Считаем demand из Wordstat
        $demand      = 0;
        $demandGrowth = 0;
        if ($wordstatTop !== null) {
            $demand = $wordstatTop['totalCount'];
        }

        // 6. YandexGPT: ТОЛЬКО текстовый анализ, без цифр
        $nicheName   = $bestPhrase;
        $verdict     = '';
        $avgCheck    = 0;
        $margin      = 0;
        $cpc         = 0;
        $competitors = [];

        $briefText = extractBriefText($db, $id);

        try {
            $prompt = buildNicheAnalysisPrompt($briefText, $bestPhrase, $wordstatTop, $searchDocs);
            $rawResponse = callYandexGPT($prompt, 0.3, 3000);

            $cleanJson = '';
            if (preg_match('/\{.*\}/s', $rawResponse, $matches)) {
                $cleanJson = $matches[0];
            }
            $parsed = json_decode($cleanJson, true);

            if (is_array($parsed)) {
                $nicheName   = (string) ($parsed['niche_name'] ?? $bestPhrase);
                $verdict     = (string) ($parsed['verdict'] ?? '');
                $avgCheck    = (int) ($parsed['avg_check'] ?? 0);
                $margin      = (int) ($parsed['margin'] ?? 0);
                $cpc         = (int) ($parsed['cpc'] ?? 0);
                $competitors = (array) ($parsed['competitors'] ?? []);
            } else {
                $sourcePayload['gpt_parse_error'] = json_last_error_msg();
            }
        } catch (Throwable $e) {
            $sourcePayload['gpt_error'] = $e->getMessage();
            $verdict = 'Ошибка ИИ-анализа: ' . $e->getMessage();
        }

        // 7. РЕАЛЬНЫЙ скоринг по формуле (НЕ от YandexGPT)
        $score = calculateNicheScore($demand, $demandGrowth, $compCount, $avgCheck, $cpc, $margin);
        // 8. Сохраняем в БД
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

            // Топ-фразы Wordstat (все собранные из каскада)
            if (!empty($allWordstatKws)) {
                $kwIns = $db->prepare(
                    'INSERT INTO wordstat_keywords (launch_id, snapshot_id, phrase, count, is_main)
                     VALUES (?, ?, ?, ?, ?)'
                );
                foreach ($allWordstatKws as $kw) {
                    $kwIns->execute([
                        $id, $snapshotId,
                        (string) ($kw['phrase'] ?? ''),
                        (int) ($kw['count'] ?? 0),
                        ($kw['phrase'] === $bestPhrase) ? 't' : 'f',
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
 * РЕАЛЬНЫЙ скоринг ниши по формуле (максимум 100 баллов).
 *
 * Факторы:
 *   - Объём спроса (Wordstat totalCount): 0–30
 *   - Рост спроса (пока заглушка 10): 0–20
 *   - Конкуренция (число найденных сайтов): 0–20
 *   - Окупаемость клика (avg_check / cpc): 0–15
 *   - Маржинальность: 0–15
 */
function calculateNicheScore(int $demand, int $growth, int $compCount, int $avgCheck, int $cpc, int $margin): int
{
    // 1. Спрос: 0 показов = 0 баллов, 100к+ = 30 баллов (логарифмическая шкала)
    $demandScore = $demand > 0 ? min(30, (int) round(log10($demand) * 10)) : 0;

    // 2. Рост: пока нейтрально 10 (GetDynamics не подключен)
    $growthScore = 10;

    // 3. Конкуренция: 0 конкурентов = 20 (идеально), 10+ = 0 (перегрето)
    $compScore = max(0, 20 - ($compCount * 2));

    // 4. Окупаемость клика: чек / cpc. Если чек в 100+ раз дороже клика = 15 баллов
    $roiScore = 0;
    if ($cpc > 0 && $avgCheck > 0) {
        $ratio = $avgCheck / $cpc;
        $roiScore = min(15, (int) round($ratio / 10));
    }

    // 5. Маржа: напрямую, но не больше 15
    $marginScore = min(15, (int) round($margin / 6));

    $total = $demandScore + $growthScore + $compScore + $roiScore + $marginScore;
    return max(1, min(100, $total));
}
/**
 * Умный подбор фразы для Wordstat: каскад фолбэков.
 *
 * 1. Пробуем исходную фразу как есть
 * 2. Если 0 показов — обрезаем после тире/скобок, берём первые 2-3 слова
 * 3. Если снова 0 — просим YandexGPT сгенерировать 3-5 коротких поисковых запроса
 * 4. Запрашиваем Wordstat для каждого, берём лучший результат
 *
 * Возвращает: ['top' => array, 'bestPhrase' => string, 'allKeywords' => array, 'queriesTried' => array]
 */
function smartWordstatQuery(string $rawPhrase, ?string $briefText = null): array
{
    $queriesTried = [];
    $allKeywords  = [];

    // Шаг 1: пробуем исходную фразу
    $phrase = trim($rawPhrase);
    $queriesTried[] = $phrase;

    try {
        $top = searchApiWordstatTop($phrase, 100);
        if ($top['totalCount'] > 0) {
            $allKeywords = array_merge($allKeywords, $top['results']);
            return [
                'top'          => $top,
                'bestPhrase'   => $phrase,
                'allKeywords'  => $allKeywords,
                'queriesTried' => $queriesTried,
            ];
        }
    } catch (Throwable $e) {
        // Продолжаем каскад
    }

    // Шаг 2: обрезаем после тире, скобок, кавычек — берём ядро
    $shortened = preg_replace('/\s*[—–\-]\s.*$/', '', $phrase);   // после тире
    $shortened = preg_replace('/\s*[\(«].*$/u', '', $shortened);   // после скобок/кавычек
    $shortened = trim($shortened);

    // Берём первые 2-3 значимых слова
    if ($shortened !== '' && $shortened !== $phrase) {
        $words  = preg_split('/\s+/', $shortened);
        $sliced = implode(' ', array_slice($words, 0, min(3, count($words))));
        $sliced = trim($sliced);
        if ($sliced !== '' && $sliced !== $phrase) {
            $queriesTried[] = $sliced;
            try {
                $top = searchApiWordstatTop($sliced, 100);
                if ($top['totalCount'] > 0) {
                    $allKeywords = array_merge($allKeywords, $top['results']);
                    return [
                        'top'          => $top,
                        'bestPhrase'   => $sliced,
                        'allKeywords'  => $allKeywords,
                        'queriesTried' => $queriesTried,
                    ];
                }
            } catch (Throwable $e) {
                // Продолжаем
            }
        }
    }

    // Шаг 3: YandexGPT генерирует поисковые запросы
    $gptQueries = [];
    try {
        $gptPrompt = "Ты — эксперт по SEO и Яндекс Wordstat. Для ниши «{$phrase}» сгенерируй 5 коротких поисковых запросов, которые реальные люди вводят в Яндекс. "
            . "Только конкретные запросы из 2-3 слов, без пояснений. Формат: каждый запрос с новой строки, без нумерации.";
        $gptResponse = callYandexGPT($gptPrompt, 0.5, 500);
        $lines = array_filter(array_map('trim', explode("\n", $gptResponse)));
        foreach ($lines as $line) {
            $clean = trim($line, " \t\n\r\0\x0B•-*–—1234567890.)");
            if ($clean !== '' && mb_strlen($clean) <= 50) {
                $gptQueries[] = $clean;
            }
            if (count($gptQueries) >= 5) break;
        }
    } catch (Throwable $e) {
        // GPT недоступен — используем фолбэк
    }

    // Фолбэк: если GPT не дал запросов, генерируем сами
    if (empty($gptQueries)) {
        $words = preg_split('/\s+/', $phrase);
        $core  = implode(' ', array_slice($words, 0, min(2, count($words))));
        $gptQueries = [
            $core . ' курс',
            $core . ' обучение',
            $core . ' онлайн',
        ];
    }

    // Шаг 4: запрашиваем Wordstat для каждого GPT-запроса
    $bestTop     = null;
    $bestPhrase2 = $phrase;
    $bestTotal   = 0;

    foreach ($gptQueries as $query) {
        $queriesTried[] = $query;
        try {
            $top = searchApiWordstatTop($query, 100);
            $allKeywords = array_merge($allKeywords, $top['results']);
            if ($top['totalCount'] > $bestTotal) {
                $bestTotal   = $top['totalCount'];
                $bestTop     = $top;
                $bestPhrase2 = $query;
            }
        } catch (Throwable $e) {
            continue;
        }
    }

    if ($bestTop !== null && $bestTotal > 0) {
        return [
            'top'          => $bestTop,
            'bestPhrase'   => $bestPhrase2,
            'allKeywords'  => $allKeywords,
            'queriesTried' => $queriesTried,
        ];
    }

    // Абсолютный фолбэк: возвращаем пустой результат
    return [
        'top'          => ['totalCount' => 0, 'results' => [], 'associations' => []],
        'bestPhrase'   => $phrase,
        'allKeywords'  => $allKeywords,
        'queriesTried' => $queriesTried,
    ];
}

/**
 * Извлекает ключевую фразу ниши из brief_answers.
 * Сначала ищет ответ с key='niche', затем по лейблу.
 * Фолбэк — название запуска.
 */
function extractNichePhrase(PDO $db, int $launchId): string
{
    $ba = $db->prepare(
        "SELECT ba.value FROM brief_answers ba
         JOIN briefs b ON b.id = ba.brief_id
         WHERE b.launch_id = ? AND ba.key = ? AND ba.value != ''
         ORDER BY b.id DESC LIMIT 1"
    );
    $ba->execute([$launchId, 'niche']);
    $row = $ba->fetch(PDO::FETCH_ASSOC);
    if ($row && trim($row['value']) !== '') {
        return trim($row['value']);
    }

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

    return !empty($lines) ? implode("\n", $lines) : 'Описание ниши отсутствует';
}
/**
 * Строит промпт для YandexGPT на основе реальных данных.
 *
 * Важно: нейросеть анализирует, а не фабрикует.
 * demand берётся из Wordstat (уже посчитан), а не придумывается.
 * Конкуренты выявляются на основе сниппетов поиска.
 * score НЕ запрашиваем — считаем по формуле.
 */
function buildNicheAnalysisPrompt(
    string $briefText,
    string $nichePhrase,
    ?array $wordstatTop,
    array $searchDocs
): string {
    $nl = "\n";

    $wordstatSection = '';
    if ($wordstatTop !== null && ($wordstatTop['totalCount'] ?? 0) > 0) {
        $topPhrases = '';
        $limit = 20;
        foreach ($wordstatTop['results'] as $i => $r) {
            if ($i >= $limit) break;
            $topPhrases .= '  - ' . $r['phrase'] . ': ' . number_format($r['count'], 0, '', ' ') . ' показов/мес' . $nl;
        }
        $wordstatSection = $nl . $nl . '--- ДАННЫЕ WORDSTAT (реальные) ---' . $nl
            . 'Суммарный спрос по фразе "' . $nichePhrase . '": '
            . number_format($wordstatTop['totalCount'], 0, '', ' ') . ' показов/мес' . $nl
            . 'Топ фраз:' . $nl . $topPhrases;
    } else {
        $wordstatSection = $nl . $nl . '--- ДАННЫЕ WORDSTAT ---' . $nl . 'Недоступны или 0 показов. Учитывай это в вердикте: спрос не подтверждён.';
    }

    $searchSection = '';
    if (!empty($searchDocs)) {
        $searchSection = $nl . $nl . '--- РЕЗУЛЬТАТЫ ПОИСКА КОНКУРЕНТОВ ---' . $nl;
        foreach ($searchDocs as $i => $doc) {
            $searchSection .= ($i + 1) . '. [' . ($doc['title'] ?? 'Без заголовка') . '](' . ($doc['url'] ?? '') . ')' . $nl
                . '   Сниппет: ' . ($doc['snippet'] ?? 'нет') . $nl;
        }
        $searchSection .= $nl . 'На основе этих сниппетов определи до 5 конкурентов (школ/курсов) в нише.';
    } else {
        $searchSection = $nl . $nl . '--- РЕЗУЛЬТАТЫ ПОИСКА КОНКУРЕНТОВ ---' . $nl . 'Недоступны. Опиши конкурентов на основе брифа, но укажи, что данные не подтверждены поиском.';
    }

    $prompt = 'Ты — ИИ-продюсер онлайн-курсов и аналитик рынка РФ. Проанализируй нишу на основе реальных данных ниже.'
        . $nl . $nl . '--- БРИФ ЭКСПЕРТА ---' . $nl . $briefText
        . $wordstatSection
        . $searchSection
        . $nl . $nl . '--- ЗАДАЧА ---' . $nl
        . 'Верни ответ СТРОГО в формате валидного JSON (только JSON, без текста вокруг):' . $nl
        . '{' . $nl
        . '  "niche_name": "Краткое название ниши",' . $nl
        . '  "verdict": "Стратегический вывод: заходить или нет, 2-3 предложения на основе данных выше",' . $nl
        . '  "avg_check": реалистичный средний чек курса в рублях (число),' . $nl
        . '  "margin": процент маржинальности от 30 до 85 (число),' . $nl
        . '  "cpc": прогноз стоимости клика в Директе в рублях (число),' . $nl
        . '  "competitors": [' . $nl
        . '    {' . $nl
        . '      "name": "Название школы/курса из сниппетов поиска",' . $nl
        . '      "students": 0,' . $nl
        . '      "check": 0,' . $nl
        . '      "rating": 0,' . $nl
        . '      "weak": "Слабое место, выявленное из сниппета или брифа",' . $nl
        . '      "power": число от 10 до 95' . $nl
        . '    }' . $nl
        . '  ]' . $nl
        . '}' . $nl
        . $nl . 'ВНИМАНИЕ:' . $nl
        . '- demand (спрос) НЕ придумывай — он уже посчитан из Wordstat и сохранён отдельно.' . $nl
        . '- score НЕ придумывай — он рассчитается по формуле отдельно.' . $nl
        . '- Если в сниппетах нет данных о числе учеников или чеке конкурента — ставь 0.' . $nl
        . '- Конкурентов определяй ТОЛЬКО на основе найденных сниппетов, не выдумывай несуществующие школы.' . $nl
        . '- Выведи ТОЛЬКО JSON, больше ни одного слова.';

    return $prompt;
}