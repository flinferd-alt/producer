const fs = require('fs');
const path = 'api/webhooks/yookassa.php';
let code = fs.readFileSync(path, 'utf8');

// Initialize $userId before the if block so it's available for logging later
code = code.replace(
    "$status = $object['status'] ?? '';",
    "$status = $object['status'] ?? '';\n    $userId = 0;  // initialized for logging below"
);

// Change the inner $userId declaration to just assignment (remove 'int' cast since already declared)
code = code.replace(
    "$userId = (int) $payment['user_id'];",
    "$userId = (int) ($payment['user_id'] ?? 0);"
);

// Add success log after pro subscription activated
code = code.replace(
    ")->execute([$tariff, $userId]);\n            } elseif ($tariff === 'studio') {",
    ")->execute([$tariff, $userId]);\n                file_put_contents(__DIR__ . '/../../logs/yookassa_webhook.log',\n                    date('c') . \" SUBSCRIPTION_ACTIVATED userId={$userId} tariff=pro\\n\", FILE_APPEND);\n            } elseif ($tariff === 'studio') {"
);

fs.writeFileSync(path, code, 'utf8');
console.log('Done');