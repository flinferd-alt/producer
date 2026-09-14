<?php

/**
 * cron_downgrade.php — cron: понижение просроченных подписок до free.
 *
 * Запуск (Beget cron, раз в час достаточно):
 *   php /home/u/USER/scripts/cron_downgrade.php
 *
 * Тестовый запуск без записи в БД:
 *   php scripts/cron_downgrade.php --dry
 *
 * Инвариант тот же, что в api/auth/me.php:
 *   subscription_status <> 'free' AND subscription_expires_at IS NOT NULL
 *   AND subscription_expires_at < now()  ->  free (expires и cancel сбрасываются).
 *
 * Один атомарный UPDATE с WHERE — нет гонки SELECT->UPDATE с вебхуком ЮKassa:
 * если пользователь оплатит между проверкой и записью, WHERE уже не сработает
 * и его свежая подписка не пострадает.
 */

declare(strict_types=1);
ini_set('display_errors', '1');
error_reporting(E_ALL);

/* Только CLI: скрипт живёт вне webroot, но подстрахуемся */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit(1);
}

$dryRun = in_array('--dry', $argv ?? [], true);

/* config.php: сервер (scripts/ рядом с public_html) или корень репо (локально) */
$configCandidates = [
    __DIR__ . '/../public_html/api/config.php',
    __DIR__ . '/../api/config.php',
];
$configPath = '';
foreach ($configCandidates as $c) {
    if (is_file($c)) { $configPath = $c; break; }
}
if ($configPath === '') {
    fwrite(STDERR, "config.php не найден (ожидался рядом с public_html или в корне репо)\n");
    exit(1);
}
require $configPath;

/* Лог: одна строка на запуск, рядом со скриптом */
define('CRON_LOG', __DIR__ . '/cron_downgrade.log');

function cron_log(string $line): void
{
    $ts = (new DateTime('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
    file_put_contents(CRON_LOG, "[$ts UTC] $line\n", FILE_APPEND | LOCK_EX);
}

/* Не плодим параллельные запуски */
$lock = @fopen(__FILE__ . '.lock', 'c');
if ($lock !== false && !flock($lock, LOCK_EX | LOCK_NB)) {
    exit(0); // предыдущий запуск ещё работает
}

try {
    $where = "subscription_status <> 'free'
              AND subscription_expires_at IS NOT NULL
              AND subscription_expires_at < now()";

    if ($dryRun) {
        /* --dry: только показываем, кто попадает под понижение, БД не трогаем */
        $rows = db()->query(
            "SELECT id, login, subscription_status AS was_status, subscription_expires_at
             FROM users WHERE $where ORDER BY subscription_expires_at"
        )->fetchAll(PDO::FETCH_ASSOC);

        echo "[DRY] Подлежат понижению до free: " . count($rows) . "\n";
        foreach ($rows as $r) {
            echo "  user #{$r['id']} ({$r['login']}): {$r['was_status']} до {$r['subscription_expires_at']}\n";
        }
        exit(0);
    }

    /* Атомарное понижение: инвариант проверяется в самом WHERE */
    $stmt = db()->prepare(
        "UPDATE users
         SET subscription_status = 'free',
             subscription_expires_at = NULL,
             subscription_cancel_at = NULL
         WHERE $where
         RETURNING id, login, subscription_status AS was_status"
    );
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $n = count($rows);

    if ($n === 0) {
        cron_log('OK: просроченных подписок нет');
        echo "OK: просроченных подписок нет\n";
    } else {
        $ids = implode(', ', array_map(fn($r) => '#' . $r['id'] . " ({$r['login']}, был {$r['was_status']})", $rows));
        cron_log("OK: понижено до free: $n — $ids");
        echo "Понижено до free: $n\n";
    }
    exit(0);

} catch (Throwable $e) {
    cron_log('ERROR: ' . $e->getMessage());
    fwrite(STDERR, 'ERROR: ' . $e->getMessage() . "\n");
    exit(1);
}