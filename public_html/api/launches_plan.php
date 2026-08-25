<?php

/**
 * launches_plan.php
 *   GET  /api/launches/{id}/plan — план запуска (воронка + тарифы + meta);
 *   POST /api/launches/{id}/plan — сохранить план:
 *        {
 *          stages:  [{ key, label, value, bench }],
 *          tariffs: [{ name, price, note, hot, features: [] }],
 *          traffic: number, price: number
 *        }
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
authenticate();
$m  = method('GET', 'POST');
$id = launchId();

$chk = db()->prepare('SELECT id FROM launches WHERE id = ?');
$chk->execute([$id]);
if ($chk->fetch() === false) {
    fail('Запуск не найден', 404);
}

if ($m === 'GET') {
    $f = db()->prepare('SELECT key, label, value, bench FROM funnel_stages WHERE launch_id = ? ORDER BY ord');
    $f->execute([$id]);
    $t = db()->prepare('SELECT name, price, note, hot, features FROM tariffs WHERE launch_id = ? ORDER BY ord');
    $t->execute([$id]);
    $l = db()->prepare('SELECT config FROM launches WHERE id = ?');
    $l->execute([$id]);
    json_out([
        'funnel'  => $f->fetchAll(),
        'tariffs' => $t->fetchAll(),
        'meta'    => json_decode((string) ($l->fetchColumn() ?: '{}'), true) ?: new stdClass(),
    ]);
}

/* --- POST --- */
$in = input();

$pdo = db();
$pdo->beginTransaction();
try {
    /* воронка: полная замена этапов запуска */
    $pdo->prepare('DELETE FROM funnel_stages WHERE launch_id = ?')->execute([$id]);
    $insF = $pdo->prepare(
        'INSERT INTO funnel_stages (launch_id, key, label, value, bench, ord)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ((array) ($in['stages'] ?? []) as $i => $s) {
        if (!is_array($s)) {
            continue;
        }
        $insF->execute([
            $id,
            (string) ($s['key'] ?? $s['id'] ?? 'stage_' . $i),
            (string) ($s['label'] ?? ''),
            (float) ($s['value'] ?? 0),
            (float) ($s['bench'] ?? 0),
            $i + 1,
        ]);
    }

    /* тарифы: полная замена */
    $pdo->prepare('DELETE FROM tariffs WHERE launch_id = ?')->execute([$id]);
    $insT = $pdo->prepare(
        'INSERT INTO tariffs (launch_id, name, price, note, hot, features, ord)
         VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)'
    );
    foreach ((array) ($in['tariffs'] ?? []) as $i => $t) {
        if (!is_array($t)) {
            continue;
        }
        $insT->execute([
            $id,
            (string) ($t['name'] ?? ''),
            (int) ($t['price'] ?? 0),
            (string) ($t['note'] ?? ''),
            !empty($t['hot']) ? 'true' : 'false',
            json_encode((array) ($t['features'] ?? []), JSON_UNESCAPED_UNICODE),
            $i + 1,
        ]);
    }

    /* meta (трафик/цена) — в jsonb-колонку launches.config */
    $meta = [
        'traffic' => (float) ($in['traffic'] ?? 0),
        'price'   => (float) ($in['price'] ?? 0),
    ];
    $pdo->prepare('UPDATE launches SET config = ?::jsonb WHERE id = ?')
        ->execute([json_encode($meta, JSON_UNESCAPED_UNICODE), $id]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    fail('Не удалось сохранить план: ' . $e->getMessage(), 500);
}

json_out(['saved' => true], 201);
