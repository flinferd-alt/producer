<?php

/**
 * config.php — bootstrap API: окружение, PDO, CORS, JSON-хелперы.
 * Подключается всеми эндпоинтами (обычно через auth_helper.php).
 */

declare(strict_types=1);

/* ---------------- 1. Переменные окружения ---------------- */

// phpdotenv (если установлен composer: cd public_html/api && composer install)
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    require __DIR__ . '/vendor/autoload.php';
    $dotenv = Dotenv\Dotenv::createImmutable(dirname(__DIR__));
    $dotenv->safeLoad();
}

// Фолбэк-парсер .env — работает без composer (на виртуальном хостинге его может не быть)
if (!isset($_ENV['DB_HOST']) && getenv('DB_HOST') === false) {
    $envFile = dirname(__DIR__) . '/.env';
    if (is_readable($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key   = trim($key);
            $value = trim($value, " \t\n\r\0\x0B\"'");
            if (!isset($_ENV[$key]) && getenv($key) === false) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
    }
}

/** Читает переменную окружения (phpdotenv -> $_ENV -> getenv -> default). */
function env(string $key, ?string $default = null): ?string
{
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return (string) $_ENV[$key];
    }
    $fromGetenv = getenv($key);
    if ($fromGetenv !== false && $fromGetenv !== '') {
        return $fromGetenv;
    }
    return $default;
}

/* ---------------- 2. PDO (PostgreSQL) ---------------- */

/**
 * Синглтон подключения. ВАЖНО: SSL задаётся через PGSSLMODE ДО создания PDO,
 * в DSN параметр sslmode НЕ пишется (иначе PDO бросает
 * "unrecognized configuration parameter").
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        putenv('PGSSLMODE=' . env('DB_SSLMODE', 'require'));
        $dsn = sprintf(
            'pgsql:host=%s;port=%s;dbname=%s',
            env('DB_HOST', 'localhost'),
            env('DB_PORT', '5432'),
            env('DB_NAME', '')
        );
        $pdo = new PDO($dsn, env('DB_USER', ''), env('DB_PASS', ''), [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

/* ---------------- 3. CORS + HTTP-хелперы ---------------- */

/** CORS: только разрешённые origins из .env (никаких «*»), preflight обрабатывается здесь же. */
function cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    // Если запрос идёт с локалхоста или нашего домена — разрешаем
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/** Единый формат успешного ответа: { success: true, data: ... } */
function json_out($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

/** Единый формат ошибки: { success: false, error: "..." } + HTTP-код (400/401/403/404/429/500). */
function fail(string $error, int $code = 400, array $extra = []): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => $error] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Тело запроса как массив (только JSON). */
function input(): array
{
    $raw     = file_get_contents('php://input');
    $decoded = json_decode($raw ?: 'null', true);
    if (!is_array($decoded)) {
        fail('Тело запроса должно быть JSON-объектом', 400);
    }
    return $decoded;
}

/** Проверка HTTP-метода; возвращает текущий метод. */
function method(string ...$allowed): string
{
    $current = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (!in_array($current, $allowed, true)) {
        fail('Метод не поддерживается: ' . $current, 405);
    }
    return $current;
}

/** id запуска из query-параметра (?id=N), ставится роутером api/.htaccess. */
function launchId(): int
{
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        fail('Требуется числовой id запуска', 400);
    }
    return $id;
}

/** Клиентский IP (для rate-limit). */
function clientIp(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

/* ---------------- 4. Серверные дефолты app_data ---------------- */

/**
 * Структурные дефолты (не демо-данные): шаблоны этапов воронки с отраслевыми
 * бенчмарками, пустые реестры платежей/каналов, список интеграций, чек-лист.
 */
function seedAppDataDefaults(): void
{
    $defaults = [
        'funnel' => [
            ['id' => 'reg',  'label' => 'Клик → регистрация',        'value' => 0, 'bench' => 10.1],
            ['id' => 'show', 'label' => 'Регистрация → пришли',      'value' => 0, 'bench' => 42.0],
            ['id' => 'stay', 'label' => 'Пришли → досмотрели оффер', 'value' => 0, 'bench' => 55.0],
            ['id' => 'buy',  'label' => 'Оффер → покупка',           'value' => 0, 'bench' => 6.4],
            ['id' => 'trip', 'label' => 'Не купили → трипваер',      'value' => 0, 'bench' => 3.6],
        ],
        'traffic' => 0,
        'price'   => 0,
        'budget'  => 0,
        'ads'     => [],
        'txs'     => [],
        'kpis'    => [],
        'integrations' => [
            ['name' => 'Beget PostgreSQL', 'desc' => 'Единая БД: запуски, платежи, события', 'on' => true,  'tone' => 'mint'],
            ['name' => 'ЮKassa',           'desc' => 'Платежи, рассрочка, чеки 54-ФЗ',       'on' => false, 'tone' => 'mint'],
            ['name' => 'VK Реклама',       'desc' => 'Таргет: креативы, аудитории, ставки',  'on' => false, 'tone' => 'sky'],
            ['name' => 'Яндекс Директ',    'desc' => 'Контекст: РСЯ и поиск',                'on' => false, 'tone' => 'amber'],
            ['name' => 'Яндекс Метрика',   'desc' => 'Сквозная аналитика, click_id',         'on' => false, 'tone' => 'amber'],
            ['name' => 'Telegram Bot API', 'desc' => 'Канал клиента + скрипт продаж',        'on' => false, 'tone' => 'sky'],
        ],
        'dbConns' => [],
        'tokens'  => [],
        'checklist' => [
            ['id' => 'ssl',       'title' => 'SSL на домене',      'desc' => 'Бесплатный Lets Encrypt в панели Beget', 'done' => false],
            ['id' => 'migrations','title' => 'Миграции БД',        'desc' => 'sql/migrations_v2.sql применён',         'done' => false],
            ['id' => 'owner',     'title' => 'Владелец в users',   'desc' => 'scripts/create_owner.php выполнен',      'done' => false],
            ['id' => 'yc',        'title' => 'YandexGPT подключён','desc' => 'YC_FOLDER_ID и YANDEX_GPT_API_KEY в .env','done' => false],
            ['id' => 'cron',      'title' => 'Cron для агентов',   'desc' => 'Цикл оркестратора каждые 15 минут',      'done' => false],
            ['id' => 'backup',    'title' => 'Автобэкапы БД',      'desc' => 'Ежедневные снапшоты PostgreSQL',         'done' => false],
            ['id' => 'consents',  'title' => 'Согласия 152-ФЗ',    'desc' => 'Политика и оферта на лендингах',         'done' => false],
            ['id' => 'monitoring','title' => 'Мониторинг',         'desc' => 'Алерты о падении API в Telegram',        'done' => false],
        ],
    ];

    $stmt = db()->prepare(
        'INSERT INTO app_data (key, value) VALUES (?, ?::jsonb)
         ON CONFLICT (key) DO NOTHING'
    );
    foreach ($defaults as $key => $value) {
        $stmt->execute([$key, json_encode($value, JSON_UNESCAPED_UNICODE)]);
    }
}
