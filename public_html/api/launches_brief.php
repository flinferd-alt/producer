<?php

/**
 * launches_brief.php
 *   GET  /api/launches/{id}/brief — бриф запуска с ответами;
 *   POST /api/launches/{id}/brief — сохранить ответы распаковки:
 *        { answers: [{ key, label, value }] }
 *        Если YandexGPT настроен — генерирует summary и пишет в briefs.summary.
 */

declare(strict_types=1);

require __DIR__ . '/auth_helper.php';
require __DIR__ . '/yandex_gpt.php';

cors();
authenticate();
$m  = method('GET', 'POST');
$id = launchId();

/* запуск должен существовать */
$chk = db()->prepare('SELECT id FROM launches WHERE id = ?');
$chk->execute([$id]);
if ($chk->fetch() === false) {
    fail('Запуск не найден', 404);
}

if ($m === 'GET') {
    $b = db()->prepare('SELECT id, status, summary, updated_at FROM briefs WHERE launch_id = ? ORDER BY id DESC LIMIT 1');
    $b->execute([$id]);
    $brief = $b->fetch();
    if ($brief === false) {
        fail('Бриф ещё не заполнялся', 404);
    }
    $a = db()->prepare('SELECT key, label, value FROM brief_answers WHERE brief_id = ? ORDER BY id');
    $a->execute([(int) $brief['id']]);
    json_out($brief + ['answers' => $a->fetchAll()]);
}

/* --- POST: сохранение брифа --- */
$in      = input();
$answers = $in['answers'] ?? null;
if (!is_array($answers) || $answers === []) {
    fail('Передайте answers: [{ key, label, value }, ...]', 400);
}

$pdo = db();
$pdo->beginTransaction();
try {
    $st = $pdo->prepare(
        "INSERT INTO briefs (launch_id, status) VALUES (?, 'complete')
         ON CONFLICT (launch_id) DO UPDATE SET status = 'complete', updated_at = now()
         RETURNING id"
    );
    $st->execute([$id]);
    $briefId = (int) $st->fetchColumn();

    $pdo->prepare('DELETE FROM brief_answers WHERE brief_id = ?')->execute([$briefId]);
    $ins = $pdo->prepare('INSERT INTO brief_answers (brief_id, key, label, value) VALUES (?, ?, ?, ?)');
    foreach ($answers as $a) {
        if (!is_array($a)) {
            continue;
        }
        $ins->execute([
            $briefId,
            (string) ($a['key'] ?? ''),
            (string) ($a['label'] ?? ''),
            (string) ($a['value'] ?? ''),
        ]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    fail('Не удалось сохранить бриф: ' . $e->getMessage(), 500);
}

/* --- YandexGPT: summary брифа (если сервис настроен) --- */
$summary   = null;
$ycStatus  = 'skipped';
if (env('YANDEX_GPT_API_KEY') !== null && env('YC_FOLDER_ID') !== null) {
    try {
        $summary  = callYandexGPT(buildBriefPrompt($answers));
        $ycStatus = 'generated';
        $pdo->prepare('UPDATE briefs SET summary = ? WHERE id = ?')->execute([$summary, $briefId]);
    } catch (Throwable $e) {
        $ycStatus = 'error: ' . $e->getMessage(); // бриф сохранён, summary нет
    }
}

json_out([
    'brief_id' => $briefId,
    'summary'  => $summary,
    'yc'       => $ycStatus,
], 201);
