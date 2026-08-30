const fs = require('fs');
const path = require('path');

const content = `<?php
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

/**
 * Проверяет, существует ли колонка user_id в таблице launches.
 * Кэширует результат на время запроса.
 */
function launchesHasUserId(PDO $db): bool
{
    static $cache = null;
    if ($cache !== null) return $cache;
    try {
        $stmt = $db->prepare(
            "SELECT column_name FROM information_schema.columns
             WHERE table_name = 'launches' AND column_name = 'user_id' LIMIT 1"
        );
        $stmt->execute();
        $cache = ($stmt->fetch() !== false);
    } catch (Throwable $e) {
        $cache = false;
    }
    return $cache;
}

try {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/auth_helper.php';

    cors();

    // Разрешаем GET, POST и PATCH
    $m = method('GET', 'POST', 'PATCH');

    // Проверяем авторизацию. Если токена нет, скрипт отдаст 401 и сам завершится.
    $who = authenticate();

    $db = db();
    $hasUserId = launchesHasUserId($db);

    if ($m === 'GET') {
        if ($hasUserId) {
            $stmt = $db->prepare(
                'SELECT id, name, expert, stage, status, config, user_id, created_at
                 FROM launches WHERE user_id = ? ORDER BY created_at DESC'
            );
            $stmt->execute([$who['user_id']]);
        } else {
            // user_id ещё не добавлен — возвращаем все запуски (fallback)
            $stmt = $db->prepare(
                'SELECT id, name, expert, stage, status, config, created_at
                 FROM launches ORDER BY created_at DESC'
            );
            $stmt->execute();
        }
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Гарантируем, что отдаем массив
        if (!is_array($rows)) {
            $rows = [];
        }
        json_out($rows);
    }

    if ($m === 'POST') {

        // Freemium: проверяем лимит бесплатных запусков
        $sub = $db->prepare('SELECT subscription_status, free_launches_used FROM users WHERE id = ?');
        $sub->execute([$who['user_id']]);
        $userInfo = $sub->fetch(PDO::FETCH_ASSOC);
        $subStatus = $userInfo['subscription_status'] ?? 'free';
        $freeUsed  = (int) ($userInfo['free_launches_used'] ?? 0);

        if ($subStatus === 'free' && $freeUsed >= 1) {
            fail('Бесплатный лимит исчерпан. Оформите тариф \\xc2\\xabПро\\xc2\\xbb для создания новых запусков.', 402);
        }

        // Увеличиваем счётчик бесплатных запусков
        if ($subStatus === 'free') {
            $db->prepare('UPDATE users SET free_launches_used = free_launches_used + 1 WHERE id = ?')->execute([$who['user_id']]);
        }

        $in = input();
        $name = trim((string)($in['name'] ?? ''));
        $expert = trim((string)($in['expert'] ?? ''));

        if ($name === '') {
            fail('Поле name обязательно', 400);
        }

        if ($hasUserId) {
            $stmt = $db->prepare(
                "INSERT INTO launches (name, expert, stage, status, config, user_id)
                         VALUES (?, ?, 'unpacking', 'active', '{}'::jsonb, ?)
                 RETURNING id, name, expert, stage, status, config, created_at"
            );
            $stmt->execute([$name, $expert, $who['user_id']]);
        } else {
            // Fallback: без user_id (миграция ещё не выполнена)
            $stmt = $db->prepare(
                "INSERT INTO launches (name, expert, stage, status, config)
                         VALUES (?, ?, 'unpacking', 'active', '{}'::jsonb)
                 RETURNING id, name, expert, stage, status, config, created_at"
            );
            $stmt->execute([$name, $expert]);
        }

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
`;

// Заменяем экранированные кавычки-ёлочки на настоящие UTF-8
const fixed = content
  .replace(/\\xc2\\xab/g, '\u00AB')  // «
  .replace(/\\xc2\\xbb/g, '\u00BB'); // »

const outPath = path.join(__dirname, '..', 'api', 'launches.php');
fs.writeFileSync(outPath, fixed, 'utf8');
console.log('OK: api/launches.php обновлён');