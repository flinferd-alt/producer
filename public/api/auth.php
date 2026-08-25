<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

putenv("PGSSLMODE=require");

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    $db_host = '10.16.0.1';  // ПРИВАТНЫЙ IP!
    $db_port = '5432';
    $db_name = 'flinferd_prod';
    $db_user = 'flinferd_app';
    $db_pass = 'loal%ZLa0EpQ';

    $dsn = "pgsql:host={$db_host};port={$db_port};dbname={$db_name}";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Ошибка парсинга JSON: " . json_last_error_msg());
    }

    $login = isset($input['login']) ? trim($input['login']) : '';
    $password = isset($input['password']) ? $input['password'] : '';

    if (empty($login) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Логин и пароль обязательны']);
        exit;
    }

    // Принимаем и Flinferd, и flinferd
    if (strtolower($login) === 'flinferd' && $password === '$Flin914101$') {
        $token = bin2hex(openssl_random_pseudo_bytes(32));

        echo json_encode([
            'success' => true,
            'token' => $token,
            'user' => [
                'login' => 'Flinferd',  // Возвращаем с большой для UI
                'id' => 'owner',
                'role' => 'owner'
            ]
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Неверный логин или пароль']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal Server Error',
        'message' => $e->getMessage()
    ]);
}
