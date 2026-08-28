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

    if ($m === 'GET') {
        $n = $db->prepare('SELECT id, score, niche_name, verdict, demand, demand_growth, avg_check, margin, cpc, created_at FROM niche_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1');
        $n->execute([$id]);
        $row = $n->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            fail('Анализ ниши ещё не сохранялся', 404);
        }

        $c = $db->prepare('SELECT name, students, price_check as check, rating, weak, power FROM competitors WHERE snapshot_id = ? ORDER BY power DESC');
        $c->execute([(int) $row['id']]);

        json_out(array_merge($row, ['competitors' => $c->fetchAll(PDO::FETCH_ASSOC)]));
    }

    /* --- POST --- */
    if ($m === 'POST') {
        $in = input();

        $score = (int) ($in['score'] ?? 0);
        $nicheName = (string) ($in['niche_name'] ?? '');
        $verdict = (string) ($in['verdict'] ?? '');

        $demand = (int) ($in['demand'] ?? 0);
        $demandGrowth = (int) ($in['demand_growth'] ?? 0);
        $avgCheck = (int) ($in['avg_check'] ?? 0);
        $margin = (int) ($in['margin'] ?? 0);
        $cpc = (int) ($in['cpc'] ?? 0);

        $competitors = (array) ($in['competitors'] ?? []);

        // ГЕНЕРИРУЕМ ЧЕРЕЗ YANDEX GPT
        if ($nicheName === '' && env('YANDEX_GPT_API_KEY')) {
            $b = $db->prepare('SELECT summary FROM briefs WHERE launch_id = ? ORDER BY id DESC LIMIT 1');
            $b->execute([$id]);
            $brief = $b->fetch(PDO::FETCH_ASSOC);
            $briefText = $brief ? ($brief['summary'] ?: 'Описание отсутствует') : 'Описание отсутствует';

            $prompt = "Ты — ИИ-продюсер онлайн-курсов и аналитик рынка РФ. Проанализируй этот бриф эксперта: '$briefText'.
Верни ответ СТРОГО в формате валидного JSON (только json, без текста вокруг), со следующей структурой:
{
  \"score\": (число от 60 до 100, насколько ниша привлекательна),
  \"niche_name\": \"(Краткое название ниши, например 'Обучение маркетплейсам')\",
  \"verdict\": \"(Краткий вердикт: заходить в нишу или нет, 2-3 предложения)\",
  \"demand\": (реалистичный прогноз количества показов в Wordstat в месяц, число от 10000 до 500000),
  \"demand_growth\": (прогноз роста спроса в процентах, например 15 или -5),
  \"avg_check\": (реалистичный средний чек курса в рублях, число),
  \"margin\": (процент маржинальности от 30 до 85, число),
  \"cpc\": (прогноз стоимости клика в Директе в рублях, число),
  \"competitors\": [
    {
      \"name\": \"(Название школы-конкурента)\",
      \"students\": (число учеников от 100 до 5000),
      \"check\": (средний чек конкурента в рублях),
      \"rating\": (рейтинг конкурента, число с точкой, например 4.8),
      \"weak\": \"(В чем их главная слабость)\",
      \"power\": (сила конкурента, число от 40 до 95)
    }
  ]
}
Придумай 3-х реалистичных конкурентов. ВНИМАНИЕ: выведи ТОЛЬКО JSON, больше ни одного слова.";

            try {
                $rawResponse = callYandexGPT($prompt, 0.4, 2000);

                // СУПЕР-ПАРСЕР: Ищем JSON от первой { до последней }
                $cleanJson = '';
                if (preg_match('/\{.*\}/s', $rawResponse, $matches)) {
                    $cleanJson = $matches[0];
                } else {
                    $cleanJson = $rawResponse;
                }

                $parsed = json_decode($cleanJson, true);

                if (is_array($parsed) && isset($parsed['score'])) {
                    $score = (int) ($parsed['score'] ?? 80);
                    $nicheName = (string) ($parsed['niche_name'] ?? 'Ниша определена');
                    $verdict = (string) ($parsed['verdict'] ?? 'Анализ завершен успешно.');

                    $demand = (int) ($parsed['demand'] ?? 150000);
                    $demandGrowth = (int) ($parsed['demand_growth'] ?? 10);
                    $avgCheck = (int) ($parsed['avg_check'] ?? 35000);
                    $margin = (int) ($parsed['margin'] ?? 65);
                    $cpc = (int) ($parsed['cpc'] ?? 80);

                    $competitors = (array) ($parsed['competitors'] ?? []);
                } else {
                    $jsonError = json_last_error_msg();
                    $preview = mb_substr($rawResponse, 0, 200);
                    throw new Exception("JSON сломан ($jsonError). Сырой ответ: " . $preview . "...");
                }
            } catch (Throwable $e) {
                $score = 75; $nicheName = "Ниша из брифа"; 
                $verdict = "Сгенерировано по умолчанию (ошибка: " . $e->getMessage() . ")";
                $demand = 50000; $demandGrowth = 5; $avgCheck = 20000; $margin = 50; $cpc = 50;
                $competitors = [];
            }
        }

        $db->beginTransaction();
        try {
            $st = $db->prepare(
                'INSERT INTO niche_snapshots (launch_id, score, niche_name, verdict, demand, demand_growth, avg_check, margin, cpc)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id'
            );
            $st->execute([$id, $score, $nicheName, $verdict, $demand, $demandGrowth, $avgCheck, $margin, $cpc]);
            $snapshotId = (int) $st->fetchColumn();

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