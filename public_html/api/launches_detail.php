<?php

/**
 * launches_detail.php — GET /api/launches/{id}
 * Возвращает запуск целиком: карточка + бриф (с ответами) + срез ниши
 * (с конкурентами) + план (этапы воронки и тарифы).
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';

cors();
authenticate();
method('GET');

$id = launchId();

$stmt = db()->prepare(
    'SELECT id, name, expert, stage, status, config, created_at FROM launches WHERE id = ?'
);
$stmt->execute([$id]);
$launch = $stmt->fetch();
if ($launch === false) {
    fail('Запуск не найден', 404);
}

/* --- бриф + ответы --- */
$brief = null;
$b     = db()->prepare('SELECT id, status, summary, updated_at FROM briefs WHERE launch_id = ? ORDER BY id DESC LIMIT 1');
$b->execute([$id]);
$briefRow = $b->fetch();
if ($briefRow !== false) {
    $a = db()->prepare('SELECT key, label, value FROM brief_answers WHERE brief_id = ? ORDER BY id');
    $a->execute([(int) $briefRow['id']]);
    $brief = $briefRow + ['answers' => $a->fetchAll()];
}

/* --- срез ниши + конкуренты --- */
$niche = null;
$n     = db()->prepare('SELECT id, score, niche_name, verdict, created_at FROM niche_snapshots WHERE launch_id = ? ORDER BY id DESC LIMIT 1');
$n->execute([$id]);
$nicheRow = $n->fetch();
if ($nicheRow !== false) {
    $c = db()->prepare('SELECT name, students, check AS price_check, rating, weak, power FROM competitors WHERE snapshot_id = ? ORDER BY power DESC');
    $c->execute([(int) $nicheRow['id']]);
    $niche = $nicheRow + ['competitors' => $c->fetchAll()];
}

/* --- план: воронка + тарифы --- */
$f = db()->prepare('SELECT key, label, value, bench FROM funnel_stages WHERE launch_id = ? ORDER BY ord');
$f->execute([$id]);
$t = db()->prepare('SELECT name, price, note, hot, features FROM tariffs WHERE launch_id = ? ORDER BY ord');
$t->execute([$id]);

json_out([
    'launch' => $launch,
    'brief'  => $brief,
    'niche'  => $niche,
    'plan'   => [
        'funnel'  => $f->fetchAll(),
        'tariffs' => $t->fetchAll(),
        'meta'    => json_decode((string) ($launch['config'] ?? '{}'), true) ?: new stdClass(),
    ],
]);
