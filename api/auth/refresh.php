<?php

/**
 * auth/refresh.php — обновление access-токена по refresh-токену.
 * Refresh приходит автоматически в httpOnly-cookie `np_refresh` (path=/api/auth/).
 * Реализована ротация: старый refresh отзывается, выдаётся новая пара.
 */

declare(strict_types=1);

require dirname(__DIR__) . '/auth_helper.php';

cors();
method('POST');

$refresh = (string) ($_COOKIE['np_refresh'] ?? '');
if ($refresh === '') {
    fail('Refresh-токен отсутствует (cookie np_refresh)', 401);
}

$payload = jwt_decode($refresh);
if ($payload === null || ($payload['type'] ?? '') !== 'refresh') {
    fail('Refresh-токен недействителен или истёк', 401);
}

/* токен должен существовать в БД и не быть отозванным */
$hash = hash('sha256', $refresh);
$stmt = db()->prepare(
    'SELECT id FROM refresh_tokens
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > now()'
);
$stmt->execute([$hash]);
$row = $stmt->fetch();
if ($row === false) {
    fail('Refresh-токен отозван или истёк', 401);
}

/* ротация: отзываем старый */
db()->prepare('UPDATE refresh_tokens SET revoked_at = now() WHERE id = ?')
    ->execute([(int) $row['id']]);

/* пользователь должен существовать */
$u = db()->prepare('SELECT id, login, role FROM users WHERE id = ?');
$u->execute([(int) $payload['user_id']]);
$user = $u->fetch();
if ($user === false) {
    fail('Пользователь не найден', 401);
}

json_out(issueTokens((int) $user['id'], (string) $user['login'], (string) $user['role']));
