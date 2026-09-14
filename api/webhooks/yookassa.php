<?php

/**
 * webhooks/yookassa.php — приём уведомлений от YooKassa (v2).
 * URL: https://producer-ai.ru/api/webhooks/yookassa
 *
 * БЕЗОПАСНОСТЬ: перед любой записью в БД объект перезапрашивается у API
 * YooKassa (GET /v3/payments/{id} или /v3/refunds/{id}, Basic auth).
 * Доверяем ТОЛЬКО ответу API — тело уведомления не доказательство.
 * Не верифицируется -> 500 (fail-closed), YooKassa повторит доставку.
 *
 * ИДЕМПОТЕНТНОСТЬ: подписка активируется только при первом переходе
 * платежа в succeeded: UPDATE ... WHERE status <> 'succeeded'; возврат
 * обрабатывается один раз: UPDATE ... WHERE refunded_at IS NULL.
 * Повторные доставки не продлевают и не сбрасывают подписку.
 */

declare(strict_types=1);
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../config.php';

    /** Лог вебхука (тот же файл, что раньше) */
    function wk_log(string $line): void
    {
        @file_put_contents(
            __DIR__ . '/../../logs/yookassa_webhook.log',
            date('c') . ' ' . $line . "\n",
            FILE_APPEND | LOCK_EX
        );
    }

    /** Ответ JSON и выход */
    function wk_out(array $payload, int $code = 200): void
    {
        http_response_code($code);
        echo json_encode($payload, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** GET к API YooKassa (Basic auth). null = не верифицировано. */
    function yk_request(string $path): ?array
    {
        $shopId = (string) env('YOOKASSA_SHOPID', '');
        $secret = (string) env('YOOKASSA_SECRET', '');
        if ($shopId === '' || $secret === '') {
            wk_log('CONFIG_MISSING: YOOKASSA_SHOPID/YOOKASSA_SECRET не заданы в .env');
            return null;
        }

        $ch = curl_init('https://api.yookassa.ru' . $path);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Authorization: Basic ' . base64_encode("$shopId:$secret")],
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $response = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($response === false || $code !== 200) {
            wk_log("VERIFY_FAIL path={$path} http={$code} err={$err}");
            return null;
        }
        $data = json_decode((string) $response, true);
        return is_array($data) ? $data : null;
    }

    /* ───────── Валидация входа ───────── */

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        wk_out(['success' => false, 'error' => 'Метод не поддерживается'], 405);
    }

    $data = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($data) || !isset($data['event'], $data['object']) || !is_array($data['object'])) {
        wk_out(['success' => false, 'error' => 'Некорректный формат уведомления'], 400);
    }

    $event  = (string) $data['event'];
    $object = $data['object'];
    $ykId   = (string) ($object['id'] ?? '');
    $status = (string) ($object['status'] ?? '');

    wk_log("RECV event={$event} ykId={$ykId} status={$status}");

    if ($ykId === '') {
        wk_out(['success' => false, 'error' => 'Нет ID объекта'], 400);
    }

    /* ───────── ВЕРИФИКАЦИЯ через API YooKassa ───────── */

    if ($event === 'payment.succeeded' || $event === 'payment.canceled') {
        $verified = yk_request("/v3/payments/{$ykId}");
    } elseif ($event === 'refund.succeeded') {
        $verified = yk_request("/v3/refunds/{$ykId}");
    } else {
        wk_log("EVENT_SKIPPED event={$event}");
        wk_out(['success' => true, 'note' => 'Событие не обрабатывается']);
    }

    if ($verified === null) {
        wk_log("UNVERIFIED event={$event} ykId={$ykId} -> 500, ждём повторную доставку");
        wk_out(['success' => false, 'error' => 'Не удалось верифицировать в API YooKassa'], 500);
    }

    if ((string) ($verified['id'] ?? '') !== $ykId || (string) ($verified['status'] ?? '') !== $status) {
        wk_log('VERIFY_MISMATCH event=' . $event . " ykId={$ykId} body={$status} api=" . ($verified['status'] ?? '?') . ' -> 500');
        wk_out(['success' => false, 'error' => 'Уведомление не совпадает с API'], 500);
    }

        /* ───────── Поиск платежа в БД ───────── */

    if ($event === 'refund.succeeded') {
        // Объект — возврат: платёж ищем по payment_id из ВЕРИФИЦИРОВАННОГО ответа API
        $payYkId = (string) ($verified['payment_id'] ?? '');
        if ($payYkId === '') {
            wk_log("REFUND_NO_PAYMENT_ID ykId={$ykId}");
            wk_out(['success' => true, 'note' => 'Возврат без payment_id — проигнорирован']);
        }
        $stmt = db()->prepare('SELECT id, user_id, tariff, status, amount, metadata, refunded_at FROM payments WHERE yookassa_id = ?');
        $stmt->execute([$payYkId]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
        $ykId = $payYkId; // дальше логируем по ID платежа
    } else {
        $stmt = db()->prepare('SELECT id, user_id, tariff, status, amount, metadata FROM payments WHERE yookassa_id = ?');
        $stmt->execute([$ykId]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    if (!$payment) {
        wk_log("PAYMENT_NOT_FOUND ykId={$ykId}");
        wk_out(['success' => true, 'note' => 'Платёж не найден в БД']);
    }

    /* ───────── payment.succeeded → активация подписки ───────── */

    if ($event === 'payment.succeeded') {
        // Сверка суммы: API vs БД (защита от модификации платежа)
        $apiAmount = (float) ($verified['amount']['value'] ?? 0);
        $dbAmount   = (float) ($payment['amount'] ?? 0);
        if ($apiAmount <= 0 || abs($apiAmount - $dbAmount) > 0.01) {
            wk_log("AMOUNT_MISMATCH ykId={$ykId} api={$apiAmount} db={$dbAmount} — АКТИВАЦИЯ ЗАПРЕЩЕНА");
            wk_out(['success' => true, 'note' => 'Сумма платежа не совпадает с БД']);
        }

        // user_id: из колонки, иначе из metadata ВЕРИФИЦИРОВАННОГО объекта
        $userId = (int) ($payment['user_id'] ?? 0);
        if ($userId === 0) {
            $meta = is_array($verified['metadata'] ?? null) ? $verified['metadata'] : [];
            if (!empty($meta['user_id'])) {
                $userId = (int) $meta['user_id'];
                db()->prepare('UPDATE payments SET user_id = ? WHERE id = ?')
                   ->execute([$userId, $payment['id']]);
                wk_log("USER_RECOVERED paymentId={$payment['id']} userId={$userId}");
            }
        }

        // Транзакция: фиксация succeeded + активация атомарны
        $txn = db();
        $txn->beginTransaction();
        $upd = $txn->prepare(
            "UPDATE payments
             SET status = 'succeeded',
                 paid_at = COALESCE(paid_at, now()),
                 payment_method_id = COALESCE(?, payment_method_id),
                 updated_at = now()
             WHERE id = ? AND status <> 'succeeded'"
        );
        $upd->execute([
            isset($verified['payment_method']['id']) ? (string) $verified['payment_method']['id'] : null,
            $payment['id'],
        ]);

        if ($upd->rowCount() === 0) {
            $txn->commit(); // статуса не меняли, ничего не должны
            wk_log("DUPLICATE payment.succeeded ykId={$ykId} — уже обработан, подписка не продлевается");
            wk_out(['success' => true, 'note' => 'Дубликат: платёж уже обработан']);
        }

        $tariff = (string) $payment['tariff'];
        if ($userId > 0 && $tariff === 'pro') {
            $txn->prepare(
                "UPDATE users
                 SET subscription_status = 'pro',
                     subscription_expires_at = now() + interval '30 days',
                     subscription_cancel_at = NULL
                 WHERE id = ?"
            )->execute([$userId]);
            wk_log("SUBSCRIPTION_ACTIVATED userId={$userId} tariff=pro expires=+30d");
        } else {
            wk_log("SUBSCRIPTION_FAILED ykId={$ykId} userId={$userId} tariff={$tariff}");
        }

        $txn->commit();
        wk_out(['success' => true]);
    }

        /* ───────── payment.canceled → только статус, подписку НЕ трогаем ───────── */

    if ($event === 'payment.canceled') {
        /* canceled бывает только у неоплаченных платежей (pending/waiting_for_capture).
         * Старая версия сбрасывала подписку здесь — это убивало АКТИВНУЮ подписку
         * пользователя, если он создавал новый платёж и бросал его. Теперь — нет. */
        db()->prepare("UPDATE payments SET status = 'canceled', updated_at = now() WHERE id = ?")
           ->execute([$payment['id']]);
        wk_log("PAYMENT_CANCELED ykId={$ykId} — подписка не менялась (платёж не был оплачен)");
        wk_out(['success' => true]);
    }

    /* ───────── refund.succeeded → возврат, сброс подписки один раз ───────── */

    if ($event === 'refund.succeeded') {
        $txn = db();
        $txn->beginTransaction();

        // Идемпотентность: обрабатываем возврат только при первом приходе
        $upd = $txn->prepare(
            'UPDATE payments SET refunded_at = COALESCE(refunded_at, now()) WHERE id = ? AND refunded_at IS NULL'
        );
        $upd->execute([$payment['id']]);

        if ($upd->rowCount() > 0) {
            $userId = (int) ($payment['user_id'] ?? 0);
            if ($userId > 0) {
                $txn->prepare(
                    "UPDATE users
                     SET subscription_status = 'free',
                         subscription_expires_at = NULL,
                         subscription_cancel_at = NULL
                     WHERE id = ?"
                )->execute([$userId]);
            }
            wk_log("REFUND_PROCESSED userId={$userId} paymentId={$payment['id']} ykId={$ykId}");
        } else {
            wk_log("DUPLICATE refund ykId={$ykId} — уже обработан, подписка не сбрасывается повторно");
        }

        $txn->commit();
        wk_out(['success' => true]);
    }

    wk_out(['success' => true]);

} catch (Throwable $e) {
    try {
        if (function_exists('db') && db()->inTransaction()) {
            db()->rollBack();
        }
    } catch (Throwable $ignored) {
    }
    @file_put_contents(
        __DIR__ . '/../../logs/yookassa_webhook.log',
        date('c') . ' EXCEPTION: ' . $e->getMessage() . "\n",
        FILE_APPEND | LOCK_EX
    );
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Исключение: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
}