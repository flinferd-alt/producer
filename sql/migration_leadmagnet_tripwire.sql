-- Миграция: таблицы лид-магнита и трипваера
-- leadmagnet_snapshots — 3 варианта A/B/C + вердикт ИИ
-- tripwire_snapshots — оффер, цена, OTO, вердикт ИИ

-- Лид-магнит
CREATE TABLE IF NOT EXISTS leadmagnet_snapshots (
    id              SERIAL PRIMARY KEY,
    launch_id       INTEGER NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
    niche_name      TEXT NOT NULL DEFAULT '',
    variants        JSONB NOT NULL DEFAULT '[]'::jsonb,
    ai_verdict      TEXT NOT NULL DEFAULT '',
    recommended_idx INTEGER NOT NULL DEFAULT 0,
    source_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leadmagnet_snapshots_launch_id ON leadmagnet_snapshots(launch_id);

-- Трипваер
CREATE TABLE IF NOT EXISTS tripwire_snapshots (
    id              SERIAL PRIMARY KEY,
    launch_id       INTEGER NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
    niche_name      TEXT NOT NULL DEFAULT '',
    title           TEXT NOT NULL DEFAULT '',
    desc_text       TEXT NOT NULL DEFAULT '',
    bullets         JSONB NOT NULL DEFAULT '[]'::jsonb,
    price           INTEGER NOT NULL DEFAULT 990,
    old_price       INTEGER NOT NULL DEFAULT 2900,
    conv            NUMERIC(5,2) NOT NULL DEFAULT 4.50,
    oto_available   BOOLEAN NOT NULL DEFAULT true,
    oto_title       TEXT NOT NULL DEFAULT '',
    oto_price       INTEGER NOT NULL DEFAULT 4900,
    oto_conv        NUMERIC(5,2) NOT NULL DEFAULT 11.00,
    ai_verdict      TEXT NOT NULL DEFAULT '',
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tripwire_snapshots_launch_id ON tripwire_snapshots(launch_id);