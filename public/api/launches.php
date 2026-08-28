<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

putenv("PGSSLMODE=require");

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $db_host = '10.16.0.1';
    $db_port = '5432';
    $db_name = 'flinferd_prod';
    $db_user = 'flinferd_app';
    $db_pass = 'loal%ZLa0EpQ';

    $dsn = "pgsql:host={$db_host};port={$db_port};dbname={$db_name}";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $stmt = $pdo->query("SELECT id, name, expert, stage, status, created_at FROM launches ORDER BY created_at DESC");
    $launches = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => $launches,
        'count' => count($launches)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Internal Server Error', 'message' => $e->getMessage()]);
}
