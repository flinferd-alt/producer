<?php

/**
 * webhooks/yookassa.php — приём уведомлений от YooKassa.
 * YooKassa присылает JSON с объектом payment при смене статуса.
 * URL для настройки в личном кабинете YooKassa:
 *   https://producer-ai.ru/api/webhooks/yookassa
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

// Webhook не требует CORS — он вызывается сервером YooKassa
header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../config.php';

    // Только POST
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Метод не поддерживается']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data) || !isset($data['event']) || !isset($data['object'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Некорректный формат уведомления']);
        exit;
    }

    $event  = $data['event'];
    $object = $data['object'];
    $ykId   = $object['id'] ?? '';
    $status = $object['status'] ?? '';

    if ($ykId === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Нет ID платежа']);
        exit;
    }

    // Находим платёж в БД
    $stmt = db()->prepare('SELECT id, user_id, tariff, status FROM payments WHERE yookassa_id = ?');
    $stmt->execute([$ykId]);
    $payment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$payment) {
        // Платёж не найден — возможно, создан вне системы.
        // Отвечаем 200, чтобы YooKassa не повторяла отправку.
        http_response_code(200);
        echo json_encode(['success' => true, 'note' => 'Платёж не найден в БД']);
        exit;
    }

    // Обновляем статус
    $paidAt = ($status === 'succeeded' && $event === 'payment.succeeded') ? 'now()' : 'NULL';
    db()->prepare(
        'UPDATE payments SET status = ?, updated_at = now(), paid_at = ' . ($paidAt === 'now()' ? 'now()' : 'paid_at') . ' WHERE id = ?'
    )->execute([$status, $payment['id']]);

    // При успешной оплате — активируем подписку
    if ($event === 'payment.succeeded' && $status === 'succeeded') {
        $userId = (int) $payment['user_id'];
        $tariff = $payment['tariff'];

        if ($tariff === 'pro') {
            db()->prepare(
                'UPDATE users SET subscription_status = ?, subscription_expires_at = now() + interval \'30 days\' WHERE id = ?'
            )->execute([$tariff, $userId]);
        } elseif ($tariff === 'studio') {
            db()->prepare(
                'UPDATE users SET subscription_status = ? WHERE id = ?'
            )->execute([$tariff, $userId]);
        }
    }

    // При отмене — возвращаем в free (если был pro и отменили)
    if ($event === 'payment.canceled' && $status === 'canceled') {
        // Ничего не делаем — подписка останется активной до истечения срока
    }

    http_response_code(200);
    echo json_encode(['success' => true]);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Исключение: ' . $e->getMessage()]);
    exit;
}