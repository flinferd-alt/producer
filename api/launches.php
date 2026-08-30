<?php
// Отключаем стандартный HTML-вывод ошибок, чтобы не ломать JSON парсеру
ini_set('display_errors', '0');
error_reporting(E_ALL);

// Супер-перехватчик: ловит даже фатальные падения ядра PHP
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR, E_PARSE])) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error'   => 'Фатальная ошибка PHP: ' . $error['message'],
            'file'    => $error['file'],
            'line'    => $error['line']
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
});

try {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/auth_helper.php';

    cors();

        // Разрешаем GET, POST и PATCH
    $m = method('GET', 'POST', 'PATCH');

    // Проверяем авторизацию. Если токена нет, скрипт отдаст 401 и сам завершится.
    $who = authenticate();

    if ($m === 'GET') {
            $db = db();
            $stmt = $db->prepare(
                'SELECT id, name, expert, stage, status, config, user_id, created_at
                 FROM launches WHERE user_id = ? ORDER BY created_at DESC'
            );
            $stmt->execute([$who['user_id']]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Гарантируем, что отдаем массив
        if (!is_array($rows)) {
            $rows = [];
        }
        json_out($rows);
    }

        if ($m === 'POST') {

        // Freemium: проверяем лимит бесплатных запусков
        $sub = db()->prepare('SELECT subscription_status, free_launches_used FROM users WHERE id = ?');
        $sub->execute([$who['user_id']]);
        $userInfo = $sub->fetch(PDO::FETCH_ASSOC);
        $subStatus = $userInfo['subscription_status'] ?? 'free';
        $freeUsed  = (int) ($userInfo['free_launches_used'] ?? 0);

        if ($subStatus === 'free' && $freeUsed >= 1) {
            fail('Бесплатный лимит исчерпан. Оформите тариф «Про» для создания новых запусков.', 402);
        }

        // Увеличиваем счётчик бесплатных запусков
        if ($subStatus === 'free') {
            db()->prepare('UPDATE users SET free_launches_used = free_launches_used + 1 WHERE id = ?')->execute([$who['user_id']]);
        }

        $in = input();
        $name = trim((string)($in['name'] ?? ''));
        $expert = trim((string)($in['expert'] ?? ''));

        if ($name === '') {
            fail('Поле name обязательно', 400);
        }

        $db = db();
        $stmt = $db->prepare(
            "INSERT INTO launches (name, expert, stage, status, config, user_id)
                         VALUES (?, ?, 'unpacking', 'active', '{}'::jsonb, ?)
             RETURNING id, name, expert, stage, status, config, created_at"
        );
        $stmt->execute([$name, $expert, $who['user_id']]);

        $launch = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$launch) {
            fail('Не удалось создать запуск (база не вернула RETURNING)', 500);
        }

        json_out($launch, 201);
    }

} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error'   => 'Исключение: ' . $e->getMessage(),
        'file'    => $e->getFile(),
        'line'    => $e->getLine()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}