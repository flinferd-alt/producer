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
        $stmt = $db->query(
            'SELECT id, name, expert, stage, status, config, created_at
             FROM launches ORDER BY created_at DESC'
        );
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Гарантируем, что отдаем массив
        if (!is_array($rows)) {
            $rows = [];
        }
        json_out($rows);
    }

    if ($m === 'POST') {
        requireOwner($who);

        $in = input();
        $name = trim((string)($in['name'] ?? ''));
        $expert = trim((string)($in['expert'] ?? ''));

        if ($name === '') {
            fail('Поле name обязательно', 400);
        }

        $db = db();
        $stmt = $db->prepare(
            "INSERT INTO launches (name, expert, stage, status, config)
             VALUES (?, ?, 'unpacking', 'active', '{}'::jsonb)
             RETURNING id, name, expert, stage, status, config, created_at"
        );
        $stmt->execute([$name, $expert]);

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