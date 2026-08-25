<?php

/**
 * data.php — настройки/данные кабинета в таблице app_data (key/value jsonb).
 *   GET /api/data — все ключи (любой авторизованный). Если таблица пуста,
 *                   сначала записываются структурные серверные дефолты.
 *   PUT /api/data — { key: value, ... } — апсерт ключей (только owner).
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
$who = authenticate();
$m   = method('GET', 'PUT');

/* белые списки ключей: только известные разделы данных */
const ALLOWED_KEYS = [
    'funnel', 'traffic', 'price', 'budget', 'ads', 'txs', 'kpis',
    'integrations', 'dbConns', 'tokens', 'checklist',
];

function fetchAllData(): array
{
    $rows = db()->query('SELECT key, value FROM app_data')->fetchAll();
    if ($rows === []) {
        seedAppDataDefaults();
        $rows = db()->query('SELECT key, value FROM app_data')->fetchAll();
    }
    $out = [];
    foreach ($rows as $row) {
        $out[(string) $row['key']] = json_decode((string) $row['value'], true);
    }
    return $out;
}

if ($m === 'GET') {
    json_out(fetchAllData());
}

/* --- PUT (владелец) --- */
requireOwner($who);

$in      = input();
$unknown = array_diff(array_keys($in), ALLOWED_KEYS);
if ($unknown !== []) {
    fail('Недопустимые ключи: ' . implode(', ', $unknown), 400);
}
if ($in === []) {
    fail('Пустое тело запроса', 400);
}

$stmt = db()->prepare(
    'INSERT INTO app_data (key, value, updated_at, updated_by)
     VALUES (?, ?::jsonb, now(), ?)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by'
);
foreach ($in as $key => $value) {
    $stmt->execute([$key, json_encode($value, JSON_UNESCAPED_UNICODE), (int) $who['user_id']]);
}

json_out(['updated' => array_keys($in)]);
