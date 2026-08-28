<?php

/**
 * data.php
 *   GET /api/data — получить данные кабинета (app_data из БД)
 *   PUT /api/data — обновить данные кабинета (только owner)
 *   Белый список ключей: funnel, traffic, budget, ads, kpis, integrations, checklist, tokens, dbConns
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
$who = authenticate();
$m = method('GET', 'PUT');

if ($m === 'GET') {
    // Получить все данные кабинета
    $rows = db()->query(
        'SELECT key, value FROM app_data ORDER BY key'
    )->fetchAll();

    $data = [];
    foreach ($rows as $row) {
        $data[$row['key']] = json_decode((string) $row['value'], true) ?? $row['value'];
    }

    json_out($data ?: []);
}

/* PUT — обновить данные */
requireOwner($who);

$in = input();

// Белый список
$allowed = [
    'funnel', 'traffic', 'budget', 'ads', 'kpis', 'integrations', 'checklist', 'tokens', 'dbConns'
];

$updated = [];
$stmt = db()->prepare(
    'INSERT INTO app_data (key, value, updated_by) VALUES (?, ?::jsonb, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = ?'
);

foreach ($allowed as $key) {
    if (isset($in[$key])) {
        $value = $in[$key];
        $jsonValue = json_encode($value, JSON_UNESCAPED_UNICODE);
        $stmt->execute([$key, $jsonValue, $who['user_id'], $who['user_id']]);
        $updated[$key] = $value;
    }
}

json_out($updated, 200);
