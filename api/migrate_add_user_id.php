<?php
/**
 * Миграция: добавляет колонку user_id в таблицу launches.
 * Запустить ОДИН РАЗ: https://producer-ai.ru/api/migrate_add_user_id.php
 * После выполнения удалить файл с сервера!
 */

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/config.php';

    $pdo = db();

    // 1. Добавляем колонку user_id, если её нет
    $pdo->exec(
        "ALTER TABLE launches ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users (id) ON DELETE SET NULL"
    );

    // 2. Индекс для быстрого поиска по user_id
    $pdo->exec(
        "CREATE INDEX IF NOT EXISTS idx_launches_user ON launches (user_id)"
    );

    // 3. Заполняем существующие записи — назначаем владельца
    $pdo->exec(
        "UPDATE launches SET user_id = (SELECT MIN(id) FROM users WHERE role = 'owner') WHERE user_id IS NULL"
    );

    echo json_encode([
        'success'  => true,
        'message'  => 'Migration OK: user_id column added to launches, index created, existing rows backfilled.',
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}