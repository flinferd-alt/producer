<?php

/**
 * auth_helper.php — JWT (HS256), authenticate(), роли, выдача пар токенов.
 * Подключает config.php. Используется всеми защищёнными эндпоинтами.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

/* ---------------- JWT (HS256, без внешних библиотек) ---------------- */

function b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string
{
    return base64_decode(strtr($data, '-_', '+/'));
}

/** Собирает JWT: header.payload.signature (HS256, секрет из JWT_SECRET). */
function jwt_encode(array $payload): string
{
    $header    = b64url_encode((string) json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $body      = b64url_encode((string) json_encode($payload, JSON_UNESCAPED_UNICODE));
    $signature = b64url_encode(hash_hmac('sha256', "$header.$body", (string) env('JWT_SECRET'), true));
    return "$header.$body.$signature";
}

/** Проверяет подпись и срок жизни; возвращает payload или null. */
function jwt_decode(string $jwt): ?array
{
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
        return null;
    }
    [$header, $body, $signature] = $parts;
    $expected = b64url_encode(hash_hmac('sha256', "$header.$body", (string) env('JWT_SECRET'), true));
    if (!hash_equals($expected, $signature)) {
        return null; // подпись не совпадает
    }
    $payload = json_decode(b64url_decode($body), true);
    if (!is_array($payload) || (int) ($payload['exp'] ?? 0) < time()) {
        return null; // битый или просрочен
    }
    return $payload;
}

/* ---------------- Проверка доступа ---------------- */

/**
 * Требует валидный access-токен в заголовке `Authorization: Bearer <token>`.
 * Возвращает payload: user_id, login, role, exp, jti. Иначе — 401.
 */
function authenticate(): array
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $auth    = $headers['Authorization']
        ?? $headers['authorization']
        ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');

    if (!preg_match('/^Bearer\s+(.+)$/i', trim((string) $auth), $matches)) {
        fail('Требуется заголовок Authorization: Bearer <token>', 401);
    }

    $payload = jwt_decode(trim($matches[1]));
    if ($payload === null) {
        fail('Токен недействителен или истёк', 401);
    }
    if (($payload['type'] ?? '') !== 'access') {
        fail('Ожидается access-токен', 401);
    }
    return $payload;
}

/** 403, если роль не owner. */
function requireOwner(array $payload): void
{
    if (($payload['role'] ?? '') !== 'owner') {
        fail('Действие доступно только владельцу', 403);
    }
}

/* ---------------- Выдача токенов ---------------- */

/**
 * Создаёт пару: access (15 мин, в теле ответа) + refresh (30 дней,
 * httpOnly-cookie для /api/auth/ + sha256-хэш в таблице refresh_tokens).
 * Refresh-токены ротируются при каждом обновлении.
 */
function issueTokens(int $userId, string $login, string $role): array
{
    $now        = time();
    $accessTtl  = (int) env('ACCESS_TTL', '900');
    $refreshTtl = (int) env('REFRESH_TTL', '2592000');

    $access = jwt_encode([
        'type'    => 'access',
        'user_id' => $userId,
        'login'   => $login,
        'role'    => $role,
        'iat'     => $now,
        'exp'     => $now + $accessTtl,
        'jti'     => bin2hex(openssl_random_pseudo_bytes(8)),
    ]);

    $jti     = bin2hex(openssl_random_pseudo_bytes(16));
    $refresh = jwt_encode([
        'type'    => 'refresh',
        'user_id' => $userId,
        'role'    => $role,
        'iat'     => $now,
        'exp'     => $now + $refreshTtl,
        'jti'     => $jti,
    ]);

    db()->prepare(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, to_timestamp(?))'
    )->execute([$userId, hash('sha256', $refresh), $now + $refreshTtl]);

    setcookie('np_refresh', $refresh, [
        'expires'  => $now + $refreshTtl,
        'path'     => '/api/auth/',   // виден только refresh.php и logout.php
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);

    return [
        'access_token' => $access,
        'token_type'   => 'Bearer',
        'expires_in'   => $accessTtl,
    ];
}

/** Отзыв refresh-токена по его значению (из cookie). */
function revokeRefreshCookie(): void
{
    $refresh = $_COOKIE['np_refresh'] ?? '';
    if ($refresh !== '') {
        db()->prepare(
            'UPDATE refresh_tokens SET revoked_at = now()
             WHERE token_hash = ? AND revoked_at IS NULL'
        )->execute([hash('sha256', $refresh)]);
    }
    setcookie('np_refresh', '', [
        'expires'  => time() - 3600,
        'path'     => '/api/auth/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}
