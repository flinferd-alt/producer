<?php

/**
 * auth.php — вход: POST { login, password }.
 *  - пароль проверяется через password_verify() против bcrypt-хэша в users;
 *  - rate-limit: 5 неудачных попыток за 15 минут (таблица login_attempts) -> 429;
 *  - при успехе: access JWT (15 мин) в теле + refresh (30 дней) в httpOnly-cookie.
 * Логин нечувствителен к регистру (strtolower при сравнении).
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
method('POST');

$in       = input();
$login    = strtolower(trim((string) ($in['login'] ?? '')));
$password = (string) ($in['password'] ?? '');

if ($login === '' || $password === '') {
    fail('Логин и пароль обязательны', 400);
}

$ip = clientIp();

/* --- rate-limit: не более 5 неудачных попыток за 15 минут с одного IP --- */
$cnt = db()->prepare(
    "SELECT COUNT(*) FROM login_attempts
     WHERE ip = ? AND lower(login) = ? AND success = false
       AND created_at > now() - interval '15 minutes'"
);
$cnt->execute([$ip, $login]);
if ((int) $cnt->fetchColumn() >= 5) {
    fail('Слишком много неудачных попыток. Повторите через 15 минут.', 429);
}

/* --- поиск пользователя и проверка пароля --- */
$stmt = db()->prepare('SELECT id, login, password_hash, role FROM users WHERE lower(login) = ? LIMIT 1');
$stmt->execute([$login]);
$user = $stmt->fetch();

$ok = $user !== false && password_verify($password, (string) $user['password_hash']);

/* фиксируем попытку для rate-limit */
db()->prepare('INSERT INTO login_attempts (ip, login, success) VALUES (?, ?, ?)')
    ->execute([$ip, $login, $ok ? 'true' : 'false']);

if (!$ok) {
    fail('Неверный логин или пароль', 401);
}

/* --- успех: выдаём пару токенов --- */
$tokens = issueTokens((int) $user['id'], (string) $user['login'], (string) $user['role']);

json_out($tokens + [
    'user' => [
        'id'    => (int) $user['id'],
        'login' => (string) $user['login'],
        'role'  => (string) $user['role'],
        // имя для UI: логин с заглавной буквы (фронтенд ждёт отображаемое имя)
        'name'  => mb_strtoupper(mb_substr($user['login'], 0, 1)) . mb_substr($user['login'], 1),
    ],
]);
