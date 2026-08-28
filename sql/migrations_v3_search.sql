"-- ============================================================
-- ПРОДЮСЕР.AI — миграция v3: интеграция Yandex Search API
--   - niche_snapshots: источники данных (wordstat / search / ai_estimate)
--   - wordstat_keywords: топ фраз из Wordstat
--   Идемпотентна: можно запускать повторно.
--   psql "postgres://user:pass@host:5432/dbname?sslmode=require" \
--        -f sql/migrations_v3_search.sql
-- ============================================================

-- Расширяем niche_snapshots: метки источников данных
ALTER TABLE niche_snapshots
  ADD COLUMN IF NOT EXISTS demand_source       TEXT NOT NULL DEFAULT 'ai_estimate',
  ADD COLUMN IF NOT EXISTS competitors_source  TEXT NOT NULL DEFAULT 'ai_estimate',
  ADD COLUMN IF NOT EXISTS source_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS search_checked_at   TIMESTAMPTZ;

-- Топ фраз Wordstat для каждого снимка ниши
CREATE TABLE IF NOT EXISTS wordstat_keywords (
    id          BIGSERIAL PRIMARY KEY,
    launch_id   INT NOT NULL REFERENCES launches (id) ON DELETE CASCADE,
    snapshot_id INT REFERENCES niche_snapshots (id) ON DELETE CASCADE,
    phrase      TEXT NOT NULL,
    count       INT NOT NULL DEFAULT 0,
    is_main     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wordstat_keywords_launch_idx   ON wordstat_keywords (launch_id);
CREATE INDEX IF NOT EXISTS wordstat_keywords_snapshot_idx ON wordstat_keywords (snapshot_id);