"<?php
/**
 * fix_subscription.php — разовый скрипт: исправляет NULL user_id в payments
 * и активирует подписку pro для пользователя 2.
 * Открыть в браузере ОДИН РАЗ, потом УДАЛИТЬ!
 */
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    // 1. Исправляем user_id в payments где он NULL, но есть в metadata
    echo "=== Fixing payments with NULL user_id ===\n";
    $stmt = db()->query("SELECT id, yookassa_id, metadata FROM payments WHERE user_id IS NULL AND metadata IS NOT NULL");
    $fixed = 0;
    foreach ($stmt as $row) {
        $meta = is_string($row['metadata']) ? json_decode($row['metadata'], true) : $row['metadata'];
        if (is_array($meta) && !empty($meta['user_id'])) {
            $uid = (int) $meta['user_id'];
            db()->prepare('UPDATE payments SET user_id = ? WHERE id = ?')->execute([$uid, $row['id']]);
            echo "  Fixed payment id=" . $row['id'] . " -> user_id=" . $uid . "\n";
            $fixed++;
        }
    }
    echo "Fixed " . $fixed . " payments.\n\n";

    // 2. Активируем подписку pro для пользователя 2
    echo "=== Activating pro subscription for user_id=2 ===\n";
    db()->prepare("UPDATE users SET subscription_status = 'pro', subscription_expires_at = now() + interval '30 days' WHERE id = 2")
       ->execute();
    $rows = db()->query("SELECT subscription_status, subscription_expires_at FROM users WHERE id = 2")->fetch(PDO::FETCH_ASSOC);
    echo "  subscription_status = " . $rows['subscription_status'] . "\n";
    echo "  subscription_expires_at = " . $rows['subscription_expires_at'] . "\n\n";

    // 3. Также обновляем статус succeeded-платежей для user_id=2
    db()->prepare("UPDATE payments SET status = 'succeeded' WHERE user_id = 2 AND status != 'succeeded' AND yookassa_id IS NOT NULL")
       ->execute();

    echo "Done! Delete this file from the server!\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}"
