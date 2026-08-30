"<?php
/**
 * debug_payments.php — диагностика таблицы payments.
 * Открыть в браузере один раз, потом удалить!
 */
declare(strict_types=1);
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== PAYMENTS TABLE COLUMNS ===\n";
$stmt = db()->query("SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'payments' ORDER BY ordinal_position");
foreach ($stmt as $row) {
    echo $row['column_name'] . ' | ' . $row['data_type'] . ' | nullable=' . $row['is_nullable'] . ' | default=' . ($row['column_default'] ?? 'NONE') . "\n";
}

echo "\n=== LAST 3 PAYMENTS ===\n";
$stmt = db()->query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 3');
foreach ($stmt as $row) {
    foreach ($row as $k => $v) {
        echo '  ' . $k . ' = ' . ($v ?? 'NULL') . "\n";
    }
    echo "---\n";
}

echo "\n=== USER ID=2 SUBSCRIPTION ===\n";
$stmt = db()->prepare('SELECT id, login, subscription_status, subscription_expires_at FROM users WHERE id = 2');
$stmt->execute();
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if ($user) {
    foreach ($user as $k => $v) {
        echo '  ' . $k . ' = ' . ($v ?? 'NULL') . "\n";
    }
} else {
    echo "  User not found\n";
}
"