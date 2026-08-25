<?php

/**
 * launches.php
 *   GET  /api/launches — список запусков (любой авторизованный);
 *   POST /api/launches — создать запуск { name, expert? } (только owner).
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
$who = authenticate();
$m   = method('GET', 'POST');

if ($m === 'GET') {
    $rows = db()->query(
        'SELECT id, name, expert, stage, status, config, created_at
         FROM launches ORDER BY created_at DESC'
    )->fetchAll();
    json_out($rows);
}

/* POST — создание запуска (владелец) */
requireOwner($who);

$in     = input();
$name   = trim((string) ($in['name'] ?? ''));
$expert = trim((string) ($in['expert'] ?? ''));

if ($name === '') {
    fail('Поле name обязательно', 400);
}

$stmt = db()->prepare(
    "INSERT INTO launches (name, expert, stage, status, config)
     VALUES (?, ?, 'unpacking', 'active', '{}'::jsonb)
     RETURNING id, name, expert, stage, status, created_at"
);
$stmt->execute([$name, $expert !== '' ? $expert : null]);

json_out($stmt->fetch(), 201);
