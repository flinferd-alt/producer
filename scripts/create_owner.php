<?php

/**
 * create_owner.php — ОДНОРАЗОВЫЙ скрипт: создаёт владельца в таблице users
 * с bcrypt-хэшем пароля (cost 12). Пароль НЕ хранится в коде — передаётся
 * аргументом командной строки.
 *
 *   php scripts/create_owner.php '<пароль владельца>'
 *
 * После успешного выполнения УДАЛИТЕ файл с сервера.
 */

declare(strict_types=1);

require __DIR__ . '/../public_html/api/config.php';

const OWNER_LOGIN = 'flinferd'; // логин владельца — всегда строчными буквами

$password = $argv[1] ?? '';
if ($password === '') {
    fwrite(STDERR, "Использование: php scripts/create_owner.php '<пароль владельца>'\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$stmt = db()->prepare(
    'INSERT INTO users (login, password_hash, role)
     VALUES (?, ?, \'owner\')
     ON CONFLICT (lower(login)) DO UPDATE SET password_hash = EXCLUDED.password_hash'
);
$stmt->execute([OWNER_LOGIN, $hash]);

echo "OK: пользователь '" . OWNER_LOGIN . "' (role=owner) создан/обновлён.\n";
echo "Хэш: " . $hash . "\n";
echo "Теперь удалите этот файл с сервера.\n";
