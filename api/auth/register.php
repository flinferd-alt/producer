<?php

/**
 * auth/register.php — регистрация: POST { login, password, name }.
 *  - логин уникальный (без учёта регистра);
 *  - пароль ≥ 6 символов, bcrypt 12 раундов;
 *  - роль всегда 'user', subscription_status = 'free';
 *  - при успехе: access JWT + refresh + user.
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR, E_PARSE])) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Фатальная ошибка PHP'], JSON_UNESCAPED_UNICODE);
        exit;
    }
});

try {
    require_once __DIR__ . '/../config.php';
    require_once __DIR__ . '/../auth_helper.php';

    cors();
    method('POST');

    $in       = input();
    $login    = strtolower(trim((string) ($in['login'] ?? '')));
    $password = (string) ($in['password'] ?? '');
    $name     = trim((string) ($in['name'] ?? ''));

    // Валидация
    if ($login === '') {
        fail('Логин обязателен', 400);
    }
    if (mb_strlen($login) < 3) {
        fail('Логин должен быть не короче 3 символов', 400);
    }
    if (mb_strlen($password) < 6) {
        fail('Пароль должен быть не короче 6 символов', 400);
    }
    if ($name === '') {
        $name = mb_strtoupper(mb_substr($login, 0, 1)) . mb_substr($login, 1);
    }

    // Проверяем, не занят ли логин
    $check = db()->prepare('SELECT id FROM users WHERE lower(login) = ? LIMIT 1');
    $check->execute([$login]);
    if ($check->fetch() !== false) {
        fail('Этот логин уже занят', 409);
    }

    // Хэш пароля (bcrypt, 12 раундов)
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    if ($hash === false) {
        fail('Ошибка хэширования пароля', 500);
    }

    // Создаём пользователя
    $stmt = db()->prepare(
        "INSERT INTO users (login, password_hash, role, subscription_status, free_launches_used)
         VALUES (?, ?, 'user', 'free', 0)
         RETURNING id, login, role, subscription_status, free_launches_used"
    );
    $stmt->execute([$login, $hash]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        fail('Не удалось создать пользователя', 500);
    }

    // Выдаём токены
    $tokens = issueTokens((int) $user['id'], (string) $user['login'], (string) $user['role']);

    json_out($tokens + [
        'user' => [
            'id'                  => (int) $user['id'],
            'login'               => (string) $user['login'],
            'role'                => (string) $user['role'],
            'name'                => $name,
            'subscription_status' => (string) ($user['subscription_status'] ?? 'free'),
            'free_launches_used'  => (int) ($user['free_launches_used'] ?? 0),
        ],
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Исключение: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}