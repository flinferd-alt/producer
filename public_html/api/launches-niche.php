<?php

/**
 * launches-niche.php
 *   GET  /api/launches/{id}/niche — получить анализ ниши
 *   POST /api/launches/{id}/niche — проанализировать нишу через YandexGPT
 *   Принимает: niche_name (обязателен)
 *   Возвращает: нишевый скор, вердикт, конкурентов
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
$who = authenticate();
$id = launchId();
$m = method('GET', 'POST');

// Проверяем запуск
$launch = db()->prepare('SELECT id, name FROM launches WHERE id = ?')->execute([$id])->fetch();
if (!$launch) {
    fail('Запуск не найден', 404);
}

if ($m === 'GET') {
    // Получить последний анализ ниши
    $snapshot = db()->prepare(
        'SELECT id, niche_name, score, verdict, created_at FROM niche_snapshots WHERE launch_id = ? ORDER BY created_at DESC LIMIT 1'
    )->execute([$id])->fetch();

    if (!$snapshot) {
        json_out([
            'launch_id' => $id,
            'niche_name' => null,
            'score' => 0,
            'verdict' => null,
            'competitors' => []
        ]);
    }

    $competitors = db()->prepare(
        'SELECT id, name, students, check, rating, weak, power FROM competitors WHERE snapshot_id = ? ORDER BY students DESC'
    )->execute([$snapshot['id']])->fetchAll();

    json_out([
        'id' => $snapshot['id'],
        'launch_id' => $id,
        'niche_name' => $snapshot['niche_name'],
        'score' => $snapshot['score'],
        'verdict' => $snapshot['verdict'],
        'competitors' => $competitors,
        'created_at' => $snapshot['created_at']
    ]);
}

/* POST — анализ ниши через YandexGPT */
$in = input();
$nicheName = trim((string) ($in['niche_name'] ?? ''));

if ($nicheName === '') {
    fail('Поле niche_name обязательно', 400);
}

try {
    require_once __DIR__ . '/yandex_gpt.php';

    // Генерируем анализ ниши
    $prompt = "Ты — эксперт в анализе онлайн-образования. "
        . "Проанализируй нишу: **$nicheName**\n\n"
        . "Оцени в формате JSON (только JSON, без текста):\n"
        . "{\n"
        . "  \"score\": <число 1-10>,\n"
        . "  \"verdict\": \"<краткий вердикт: перспективна/насыщена/новая>\",\n"
        . "  \"competitors\": [\n"
        . "    {\"name\": \"<имя конкурента>\", \"students\": <число>, \"check\": <средний чек в рублях>, \"rating\": <число 1-5>, \"weak\": \"<главная слабость>\", \"power\": <балл конкуренции 1-10>},\n"
        . "    {\"name\": \"<ещё конкурент>\", ...}\n"
        . "  ]\n"
        . "}";

    $response = callYandexGPT($prompt, 0.5, 3000);

    // Парсим JSON (берём всё между первой { и последней })
    $jsonStart = strpos($response, '{');
    $jsonEnd = strrpos($response, '}');
    if ($jsonStart === false || $jsonEnd === false) {
        throw new RuntimeException('YandexGPT ответ не содержит JSON');
    }

    $jsonStr = substr($response, $jsonStart, $jsonEnd - $jsonStart + 1);
    $data = json_decode($jsonStr, true);
    if (!is_array($data)) {
        throw new RuntimeException('Ошибка парсинга JSON: ' . json_last_error_msg());
    }

    $score = (int) ($data['score'] ?? 5);
    $verdict = trim((string) ($data['verdict'] ?? 'неизвестен'));
    $competitors = $data['competitors'] ?? [];

    // Сохраняем snapshot
    $stmt = db()->prepare(
        'INSERT INTO niche_snapshots (launch_id, niche_name, score, verdict) VALUES (?, ?, ?, ?) RETURNING id'
    );
    $stmt->execute([$id, $nicheName, $score, $verdict]);
    $snapshotId = $stmt->fetch()['id'];

    // Сохраняем конкурентов
    $insertCompStmt = db()->prepare(
        'INSERT INTO competitors (snapshot_id, name, students, check, rating, weak, power) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    foreach ($competitors as $comp) {
        if (!is_array($comp)) {
            continue;
        }
        $insertCompStmt->execute([
            $snapshotId,
            $comp['name'] ?? '',
            (int) ($comp['students'] ?? 0),
            (int) ($comp['check'] ?? 0),
            (float) ($comp['rating'] ?? 0),
            $comp['weak'] ?? '',
            (int) ($comp['power'] ?? 0)
        ]);
    }

    json_out([
        'id' => $snapshotId,
        'launch_id' => $id,
        'niche_name' => $nicheName,
        'score' => $score,
        'verdict' => $verdict,
        'competitors' => array_map(function ($c) {
            return [
                'name' => $c['name'] ?? '',
                'students' => (int) ($c['students'] ?? 0),
                'check' => (int) ($c['check'] ?? 0),
                'rating' => (float) ($c['rating'] ?? 0),
                'weak' => $c['weak'] ?? '',
                'power' => (int) ($c['power'] ?? 0)
            ];
        }, $competitors)
    ], 201);

} catch (RuntimeException $e) {
    fail('Ошибка анализа ниши: ' . $e->getMessage(), 500);
}
