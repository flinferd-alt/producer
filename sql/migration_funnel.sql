-- Миграция: таблица ИИ-генерации воронки продаж
-- funnel_snapshots — этапы вебинарной воронки с бенчмарками ниши,
-- оптимизированными значениями, планом трафика и вердиктом ИИ.

CREATE TABLE IF NOT EXISTS funnel_snapshots (
    id              SERIAL PRIMARY KEY,
    launch_id       INTEGER NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
    niche_name      TEXT NOT NULL DEFAULT '',
    model           TEXT NOT NULL DEFAULT 'webinar',
    stages          JSONB NOT NULL DEFAULT '[]'::jsonb,
    traffic         INTEGER NOT NULL DEFAULT 12000,
    price           INTEGER NOT NULL DEFAULT 24900,
    optimized       JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_verdict      TEXT NOT NULL DEFAULT '',
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnel_snapshots_launch_id ON funnel_snapshots(launch_id);