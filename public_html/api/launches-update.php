<?php

/**
 * launches-update.php
 *   PUT /api/launches/{id} — обновление запуска (только owner)
 *   Принимает: name, expert, stage, status, progress (все опциональны)
 *   Обновляет соответствующие поля в таблице launches
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
$who = authenticate();
requireOwner($who);
method('PUT');

$id = launchId();

$in = input();
$updates = [];
$params = [];

// Только разрешённые поля
if (isset($in['name'])) {
    $name = trim((string) $in['name']);
    if ($name === '') {
        fail('Поле name не может быть пустым', 400);
    }
    $updates[] = 'name = ?';
    $params[] = $name;
}

if (isset($in['expert'])) {
    $expert = trim((string) $in['expert']);
    $updates[] = 'expert = ?';
    $params[] = $expert !== '' ? $expert : null;
}

if (isset($in['stage'])) {
    $stage = trim((string) $in['stage']);
    if (!in_array($stage, ['unpacking', 'brief', 'niche', 'plan', 'ready'], true)) {
        fail('Неверное значение stage', 400);
    }
    $updates[] = 'stage = ?';
    $params[] = $stage;
}

if (isset($in['status'])) {
    $status = trim((string) $in['status']);
    if (!in_array($status, ['active', 'paused', 'archived'], true)) {
        fail('Неверное значение status', 400);
    }
    $updates[] = 'status = ?';
    $params[] = $status;
}

if (isset($in['progress'])) {
    $progress = (int) $in['progress'];
    if ($progress < 0 || $progress > 100) {
        fail('progress должен быть от 0 до 100', 400);
    }
    $updates[] = 'progress = ?';
    $params[] = $progress;
}

if (empty($updates)) {
    fail('Нечего обновлять', 400);
}

$updates[] = 'updated_at = now()';
$params[] = $id;

$sql = 'UPDATE launches SET ' . implode(', ', $updates) . ' WHERE id = ? RETURNING id, name, expert, stage, status, progress, updated_at';

$stmt = db()->prepare($sql);
$stmt->execute($params);

$row = $stmt->fetch();
if (!$row) {
    fail('Запуск не найден', 404);
}

json_out($row);
