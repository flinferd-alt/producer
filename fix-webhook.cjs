const fs = require('fs');

const path = 'api/webhooks/yookassa.php';
let code = fs.readFileSync(path, 'utf8');

// 1. Add logging after payment found
code = code.replace(
    "if (!$payment) {\n        // Платёж не найден — возможно, создан вне системы.\n        // Отвечаем 200, чтобы YooKassa не повторяла отправку.\n        http_response_code(200);",
    "if (!$payment) {\n        file_put_contents(__DIR__ . '/../../logs/yookassa_webhook.log',\n            date('c') . \" PAYMENT_NOT_FOUND ykId={$ykId}\\n\", FILE_APPEND);\n        http_response_code(200);"
);

// 2. Add logging after payment found (before status update)
code = code.replace(
    "    // Обновляем статус\n    $paidAt",
    "    file_put_contents(__DIR__ . '/../../logs/yookassa_webhook.log',\n        date('c') . \" PAYMENT_FOUND id={$payment['id']} user_id=\" . ($payment['user_id'] ?? 'NULL') . \" tariff={$payment['tariff']}\\n\", FILE_APPEND);\n\n    // Обновляем статус\n    $paidAt"
);

// 3. Add logging after subscription update
code = code.replace(
    "            )->execute([$tariff, $userId]);\n        } elseif ($tariff === 'studio') {",
    "            )->execute([$tariff, $userId]);\n                file_put_contents(__DIR__ . '/../../logs/yookassa_webhook.log',\n                    date('c') . \" SUBSCRIPTION_ACTIVATED userId={$userId} tariff={$tariff}\\n\", FILE_APPEND);\n        } elseif ($tariff === 'studio') {"
);

// 4. Add logging when userId is 0 (no subscription activated)
code = code.replace(
    "    }\n\n    // При отмене",
    "    }\n\n    if ($event === 'payment.succeeded' && $status === 'succeeded' && $userId === 0) {\n        file_put_contents(__DIR__ . '/../../logs/yookassa_webhook.log',\n            date('c') . \" SUBSCRIPTION_FAILED userId=0 tariff=\" . ($payment['tariff'] ?? '?') . \"\\n\", FILE_APPEND);\n    }\n\n    // При отмене"
);

fs.writeFileSync(path, code, 'utf8');
console.log('Done');