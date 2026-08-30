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
    $userId = 0;  // initialized for logging below

    // Логируем входящий вебхук
    $logLine = date('c') . " event={$event} ykId={$ykId} status={$status}\n";
    file_put_contents(__DIR__ . '/../../logs/yookassa_webhook.log', $logLine, FILE_APPEND);

    if ($ykId === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Нет ID платежа']);
        exit;
    }

    // Находим платёж в БД
    $stmt = db()->prepare('SELECT id, user_id, tariff, status, metadata FROM payments WHERE yookassa_id = ?');
    $stmt->execute([$ykId]);
    $payment = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$payment) {
        file_put_contents(__DIR__ . '/../../logs/yookassa_webhook.log',
            date('c') . " PAYMENT_NOT_FOUND ykId={$ykId}\n", FILE_APPEND);
        http_response_code(200);
        echo json_encode(['success' => true, 'note' => 'Платёж не найден в БД']);
        exit;
    }

    file_put_contents(__DIR__ . '/../../logs/yookassa_webhook.log',
        date('c') . " PAYMENT_FOUND id={$payment['id']} user_id=" . ($payment['user_id'] ?? 'NULL') . " tariff={$payment['tariff']}\n", FILE_APPEND);

    // Обновляем статус
    $paidAt = ($status === 'succeeded' && $event === 'payment.succeeded') ? 'now()' : 'NULL';
    db()->prepare(
        'UPDATE payments SET status = ?, updated_at = now(), paid_at = ' . ($paidAt === 'now()' ? 'now()' : 'paid_at') . ' WHERE id = ?'
    )->execute([$status, $payment['id']]);

    // При успешной оплате — активируем подписку
    if ($event === 'payment.succeeded' && $status === 'succeeded') {
        $userId = (int) ($payment['user_id'] ?? 0);
        $tariff = $payment['tariff'];

        // Fallback: если user_id не записан в колонке — берём из metadata
        if ($userId === 0 && !empty($payment['metadata'])) {
            $meta = is_string($payment['metadata'])
                ? json_decode($payment['metadata'], true)
                : $payment['metadata'];
            if (is_array($meta) && !empty($meta['user_id'])) {
                $userId = (int) $meta['user_id'];
                // Восстанавливаем user_id в колонке payments
                db()->prepare('UPDATE payments SET user_id = ? WHERE id = ?')
                   ->execute([$userId, $payment['id']]);
            }
        }

        // Fallback #2: берём user_id из metadata объекта webhook от YooKassa
        if ($userId === 0 && !empty($object['metadata']['user_id'])) {
            $userId = (int) $object['metadata']['user_id'];
            db()->prepare('UPDATE payments SET user_id = ? WHERE id = ?')
               ->execute([$userId, $payment['id']]);
        }

        if ($userId > 0 && in_array($tariff, ['pro', 'studio'], true)) {
            if ($tariff === 'pro') {
                db()->prepare(
                    'UPDATE users SET subscription_status = ?, subscription_expires_at = now() + interval \'30 days\' WHERE id = ?'
                )->execute([$tariff, $userId]);
                file_put_contents(__DIR__ . '/../../logs/yookassa_webhook.log',
                    date('c') . " SUBSCRIPTION_ACTIVATED userId={$userId} tariff=pro\n", FILE_APPEND);
            } elseif ($tariff === 'studio') {
                db()->prepare(
                    'UPDATE users SET subscription_status = ? WHERE id = ?'
                )->execute([$tariff, $userId]);
            }
        }
    }

    if ($event === 'payment.succeeded' && $status === 'succeeded' && $userId === 0) {
        file_put_contents(__DIR__ . '/../../logs/yookassa_webhook.log',
            date('c') . " SUBSCRIPTION_FAILED userId=0 tariff=" . ($payment['tariff'] ?? '?') . "\n", FILE_APPEND);
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