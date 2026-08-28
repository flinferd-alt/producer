<?php

/**
 * launches-delete.php
 *   DELETE /api/launches/{id} — удаление запуска (только owner)
 *   Удаляет запуск и всю связанную информацию (briefs, niche, etc.)
 *   благодаря ON DELETE CASCADE в миграциях
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
$who = authenticate();
requireOwner($who);
method('DELETE');

$id = launchId();

$stmt = db()->prepare('DELETE FROM launches WHERE id = ? RETURNING id');
$stmt->execute([$id]);

if (!$stmt->fetch()) {
    fail('Запуск не найден', 404);
}

json_out(['id' => $id, 'deleted' => true]);
