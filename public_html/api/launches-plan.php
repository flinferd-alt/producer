<?php

/**
 * launches-plan.php
 *   GET  /api/launches/{id}/plan — получить план (воронка + тарифы)
 *   POST /api/launches/{id}/plan — сохранить план
 *   Принимает: funnel (массив этапов), tariffs (массив тарифов)
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
$who = authenticate();
$id = launchId();
$m = method('GET', 'POST');

// Проверяем запуск
$launch = db()->prepare('SELECT id FROM launches WHERE id = ?')->execute([$id])->fetch();
if (!$launch) {
    fail('Запуск не найден', 404);
}

if ($m === 'GET') {
    // Получить план
    $funnel = db()->prepare(
        'SELECT key, label, value, bench FROM funnel_stages WHERE launch_id = ? ORDER BY ord'
    )->execute([$id])->fetchAll();

    $tariffs = db()->prepare(
        'SELECT id, name, price, note, hot, features FROM tariffs WHERE launch_id = ? ORDER BY ord'
    )->execute([$id])->fetchAll();

    json_out([
        'launch_id' => $id,
        'funnel' => $funnel,
        'tariffs' => array_map(function ($t) {
            return [
                'id' => $t['id'],
                'name' => $t['name'],
                'price' => (int) $t['price'],
                'note' => $t['note'],
                'hot' => (bool) $t['hot'],
                'features' => json_decode((string) $t['features'], true) ?? []
            ];
        }, $tariffs)
    ]);
}

/* POST — сохранить план */
requireOwner($who);

$in = input();
$funnel = $in['funnel'] ?? [];
$tariffs = $in['tariffs'] ?? [];

if (!is_array($funnel) || !is_array($tariffs)) {
    fail('funnel и tariffs должны быть массивами', 400);
}

// Очищаем старый план
db()->prepare('DELETE FROM funnel_stages WHERE launch_id = ?')->execute([$id]);
db()->prepare('DELETE FROM tariffs WHERE launch_id = ?')->execute([$id]);

// Сохраняем новый план
$funnelStmt = db()->prepare(
    'INSERT INTO funnel_stages (launch_id, key, label, value, bench, ord) VALUES (?, ?, ?, ?, ?, ?)'
);

foreach ($funnel as $idx => $stage) {
    if (!is_array($stage)) {
        continue;
    }
    $funnelStmt->execute([
        $id,
        $stage['key'] ?? '',
        $stage['label'] ?? '',
        (float) ($stage['value'] ?? 0),
        (float) ($stage['bench'] ?? 0),
        $idx
    ]);
}

$tariffStmt = db()->prepare(
    'INSERT INTO tariffs (launch_id, name, price, note, hot, features, ord) VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)'
);

foreach ($tariffs as $idx => $tariff) {
    if (!is_array($tariff)) {
        continue;
    }
    $tariffStmt->execute([
        $id,
        $tariff['name'] ?? '',
        (int) ($tariff['price'] ?? 0),
        $tariff['note'] ?? '',
        (bool) ($tariff['hot'] ?? false),
        json_encode($tariff['features'] ?? [], JSON_UNESCAPED_UNICODE),
        $idx
    ]);
}

json_out([
    'launch_id' => $id,
    'funnel' => $funnel,
    'tariffs' => $tariffs
], 201);
