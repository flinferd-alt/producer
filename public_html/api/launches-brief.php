<?php

/**
 * launches-brief.php
 *   GET  /api/launches/{id}/brief — получить бриф и ответы распаковки
 *   POST /api/launches/{id}/brief — сохранить ответы распаковки
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
$who = authenticate();
$id = launchId();
$m = method('GET', 'POST');

// Проверяем, что запуск существует
$launch = db()->prepare('SELECT id, name FROM launches WHERE id = ?')->execute([$id])->fetch();
if (!$launch) {
    fail('Запуск не найден', 404);
}

if ($m === 'GET') {
    // Получить бриф и ответы
    $brief = db()->prepare(
        'SELECT id, launch_id, status, summary, created_at, updated_at FROM briefs WHERE launch_id = ?'
    )->execute([$id])->fetch();

    if (!$brief) {
        json_out([
            'launch_id' => $id,
            'status' => 'draft',
            'summary' => null,
            'answers' => []
        ]);
    }

    $answers = db()->prepare(
        'SELECT key, label, value FROM brief_answers WHERE brief_id = ? ORDER BY id'
    )->execute([$brief['id']])->fetchAll();

    json_out([
        'id' => $brief['id'],
        'launch_id' => $brief['launch_id'],
        'status' => $brief['status'],
        'summary' => $brief['summary'],
        'answers' => $answers,
        'created_at' => $brief['created_at'],
        'updated_at' => $brief['updated_at']
    ]);
}

/* POST — сохранить ответы и сгенерировать summary через YandexGPT */
$in = input();
$answers = $in['answers'] ?? [];

if (!is_array($answers)) {
    fail('Поле answers должно быть массивом', 400);
}

// Получить или создать бриф
$brief = db()->prepare('SELECT id FROM briefs WHERE launch_id = ?')->execute([$id])->fetch();
$briefId = null;

if (!$brief) {
    $stmt = db()->prepare(
        'INSERT INTO briefs (launch_id, status) VALUES (?, ?) RETURNING id'
    );
    $stmt->execute([$id, 'draft']);
    $briefId = $stmt->fetch()['id'];
} else {
    $briefId = $brief['id'];
}

// Удалить старые ответы
db()->prepare('DELETE FROM brief_answers WHERE brief_id = ?')->execute([$briefId]);

// Вставить новые ответы
$insertStmt = db()->prepare(
    'INSERT INTO brief_answers (brief_id, key, label, value) VALUES (?, ?, ?, ?)'
);

foreach ($answers as $ans) {
    if (!is_array($ans) || !isset($ans['value'])) {
        continue;
    }
    $insertStmt->execute([
        $briefId,
        $ans['key'] ?? '',
        $ans['label'] ?? '',
        $ans['value'] ?? ''
    ]);
}

// Генерируем summary через YandexGPT (если ответы не пусты)
$summary = null;
if (!empty($answers)) {
    try {
        require_once __DIR__ . '/yandex_gpt.php';
        $prompt = buildBriefPrompt($answers);
        $summary = callYandexGPT($prompt, 0.7, 2000);

        // Обновляем бриф с summary
        db()->prepare(
            'UPDATE briefs SET summary = ?, status = ?, updated_at = now() WHERE id = ?'
        )->execute([$summary, 'generated', $briefId]);
    } catch (RuntimeException $e) {
        // Если YandexGPT не работает, сохраняем ответы, но summary остаётся null
        error_log('YandexGPT ошибка: ' . $e->getMessage());
        db()->prepare(
            'UPDATE briefs SET updated_at = now() WHERE id = ?'
        )->execute([$briefId]);
    }
}

json_out([
    'id' => $briefId,
    'launch_id' => $id,
    'status' => $summary ? 'generated' : 'draft',
    'summary' => $summary,
    'answers' => $answers
]);
