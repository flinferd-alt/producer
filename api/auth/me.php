<?php

/**
 * auth/me.php — текущий профиль пользователя из БД.
 * GET /api/auth/me
 * Обновляет subscription_status, free_launches_used — актуальные данные,
 * а не те что были при логине (могли устареть после оплаты).
 * Также проверяет subscription_expires_at: если просрочен — сбрасывает в 'free'.
 */

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

try {
    require_once __DIR__ . '/../config.php';
    require_once __DIR__ . '/auth_helper.php';

    cors();
    method('GET');
    $who = authenticate();

    $stmt = db()->prepare(
        'SELECT id, login, role, subscription_status, free_launches_used, subscription_expires_at
         FROM users WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$who['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        fail('Пользователь не найден', 404);
    }

    // Проверяем истечение подписки
    $status = (string) ($user['subscription_status'] ?? 'free');
    $expiresAt = $user['subscription_expires_at'] ?? null;

    if ($status !== 'free' && $expiresAt !== null) {
        $now = new DateTime('now', new DateTimeZone('UTC'));
        $expires = new DateTime($expiresAt, new DateTimeZone('UTC'));

        if ($expires < $now) {
            // Подписка просрочена — сбрасываем в free
            $resetStmt = db()->prepare(
                "UPDATE users SET subscription_status = 'free', subscription_expires_at = NULL WHERE id = ?"
            );
            $resetStmt->execute([(int) $user['id']]);
            $status = 'free';
            $expiresAt = null;
        }
    }

    json_out([
        'id'                      => (int) $user['id'],
        'login'                   => (string) $user['login'],
        'role'                    => (string) $user['role'],
        'name'                    => mb_strtoupper(mb_substr($user['login'], 0, 1)) . mb_substr($user['login'], 1),
        'subscription_status'     => $status,
        'free_launches_used'      => (int) ($user['free_launches_used'] ?? 0),
        'subscription_expires_at' => $expiresAt,
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}