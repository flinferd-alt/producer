<?php

/**
 * payments.php — платежи YooKassa и управление подпиской.
 *
 * POST   /api/payments { tariff: "pro"|"studio" }
 *   → { confirmation_url, payment_id }
 *
 * GET    /api/payments
 *   → { subscription, payments: [...] }  — текущая подписка + история платежей
 *
 * DELETE /api/payments
 *   → { canceled: true }  — запланировать отмену подписки (deactivation)
 */

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null && in_array($error['type'], [E_ERROR, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR, E_PARSE])) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'error' => 'Фатальная ошибка PHP: ' . $error['message']], JSON_UNESCAPED_UNICODE);
        exit;
    }
});

try {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/auth_helper.php';

    cors();
    $m = method('GET', 'POST', 'DELETE');
    $who = authenticate();

    /* ───────────── GET: подписка + история платежей ───────────── */
    if ($m === 'GET') {
        $stmt = db()->prepare(
            'SELECT subscription_status, subscription_expires_at,
                    free_launches_used, subscription_cancel_at
             FROM users WHERE id = ?'
        );
        $stmt->execute([$who['user_id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        $stmt = db()->prepare(
            'SELECT id, yookassa_id, tariff, amount, currency, status,
                    description, paid_at, refunded_at, created_at
             FROM payments
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 50'
        );
        $stmt->execute([$who['user_id']]);
        $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);

        json_out([
            'subscription' => [
                'status'     => $user['subscription_status'] ?? 'free',
                'expires_at' => $user['subscription_expires_at'] ?? null,
                'cancel_at'  => $user['subscription_cancel_at'] ?? null,
                'free_launches_used' => (int) ($user['free_launches_used'] ?? 0),
            ],
            'payments' => $payments,
        ]);
    }

    /* ───────────── DELETE: запланировать отмену подписки ───────────── */
    if ($m === 'DELETE') {
        db()->prepare(
            'UPDATE users
             SET subscription_cancel_at = subscription_expires_at
             WHERE id = ?'
        )->execute([$who['user_id']]);

        json_out(['canceled' => true, 'note' => 'Подписка будет отменена по истечении оплаченного периода']);
    }

    /* ───────────── POST: создание платежа в YooKassa ───────────── */
    $in = input();
    $tariff = trim((string)($in['tariff'] ?? ''));

    // Тарифы и цены
    $TARIFFS = [
        'pro'    => ['price' => 4900, 'desc' => 'Подписка ПРОДЮСЕР.AI — тариф «Про» (1 месяц)'],
        'studio' => ['price' => 0,    'desc' => 'Подписка ПРОДЮСЕР.AI — тариф «Студия» (по договорённости)'],
    ];

    if (!isset($TARIFFS[$tariff])) {
        fail('Неизвестный тариф. Доступны: pro, studio', 400);
    }

    if ($tariff === 'studio') {
        // Студия — не через YooKassa, редирект на связь
        json_out([
            'confirmation_url' => 'https://t.me/bazhenov_app',
            'payment_id' => null,
            'note' => 'Тариф «Студия» оформляется через менеджера',
        ]);
    }

    $price    = $TARIFFS[$tariff]['price'];
    $desc     = $TARIFFS[$tariff]['desc'];
    $shopId   = (string) env('YOOKASSA_SHOPID', '');
    $secret   = (string) env('YOOKASSA_SECRET', '');

    if ($shopId === '' || $secret === '') {
        fail('YooKassa не настроена: укажите YOOKASSA_SHOPID и YOOKASSA_SECRET в .env', 500);
    }

    // Идемпотентность: ключ генерируем на стороне сервера
    $idempotenceKey = bin2hex(openssl_random_pseudo_bytes(16));

    $payload = [
        'amount' => [
            'value'    => number_format($price, 2, '.', ''),
            'currency' => 'RUB',
        ],
        'capture' => true,
        'confirmation' => [
            'type' => 'redirect',
            'return_url' => (string) env('YOOKASSA_RETURN_URL', 'https://producer-ai.ru/?paid=1'),
        ],
        'description' => $desc,
        'save_payment_method' => true, // Разрешаем сохранение способа оплаты для рекуррентных списаний
        'metadata' => [
            'user_id'  => (string) $who['user_id'],
            'login'    => $who['login'] ?? '',
            'tariff'   => $tariff,
        ],
    ];

    $ch = curl_init('https://api.yookassa.ru/v3/payments');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Idempotence-Key: ' . $idempotenceKey,
            'Authorization: Basic ' . base64_encode("$shopId:$secret"),
        ],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        fail('Ошибка соединения с YooKassa: ' . $curlErr, 502);
    }

    $yk = json_decode($response, true);
    if (!is_array($yk) || !isset($yk['id'])) {
        fail('YooKassa вернула некорректный ответ (HTTP ' . $httpCode . ')', 502);
    }

    // Сохраняем платёж в БД
    $confirmationUrl = $yk['confirmation']['confirmation_url'] ?? '';
    $ykId = $yk['id'];
    $status = $yk['status'] ?? 'pending';

    db()->prepare(
        'INSERT INTO payments (yookassa_id, user_id, tariff, amount, currency, status, description, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb)'
    )->execute([
        $ykId,
        $who['user_id'],
        $tariff,
        $price,
        'RUB',
        $status,
        $desc,
        json_encode($payload['metadata'], JSON_UNESCAPED_UNICODE),
    ]);

    json_out([
        'confirmation_url' => $confirmationUrl,
        'payment_id'       => $ykId,
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Исключение: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}