<?php

/**
 * launches_niche.php
 *   GET  /api/launches/{id}/niche — последний срез анализа ниши;
 *   POST /api/launches/{id}/niche — сохранить срез:
 *        { score, niche_name, verdict, competitors: [{ name, students, check, rating, weak, power }] }
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
    $n = db()->prepare('SELECT id, score, niche_name, verdict, created_at FROM niche_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1');
    $n->execute([$id]);
    $row = $n->fetch();
    if ($row === false) {
        fail('Анализ ниши ещё не сохранялся', 404);
    }
    $c = db()->prepare('SELECT name, students, check AS price_check, rating, weak, power FROM competitors WHERE snapshot_id = ? ORDER BY power DESC');
    $c->execute([(int) $row['id']]);
    json_out($row + ['competitors' => $c->fetchAll()]);
}

/* --- POST --- */
$in = input();

$pdo = db();
$pdo->beginTransaction();
try {
    $st = $pdo->prepare(
        'INSERT INTO niche_snapshots (launch_id, score, niche_name, verdict)
         VALUES (?, ?, ?, ?) RETURNING id'
    );
    $st->execute([
        $id,
        (int) ($in['score'] ?? 0),
        (string) ($in['niche_name'] ?? ''),
        (string) ($in['verdict'] ?? ''),
    ]);
    $snapshotId = (int) $st->fetchColumn();

    $ins = $pdo->prepare(
        'INSERT INTO competitors (snapshot_id, name, students, check, rating, weak, power)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ((array) ($in['competitors'] ?? []) as $c) {
        if (!is_array($c)) {
            continue;
        }
        $ins->execute([
            $snapshotId,
            (string) ($c['name'] ?? ''),
            (int) ($c['students'] ?? 0),
            (int) ($c['check'] ?? 0),
            (float) ($c['rating'] ?? 0),
            (string) ($c['weak'] ?? ''),
            (int) ($c['power'] ?? 0),
        ]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    fail('Не удалось сохранить анализ ниши: ' . $e->getMessage(), 500);
}

json_out(['snapshot_id' => $snapshotId], 201);
