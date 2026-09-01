"-- Миграция: таблица стратегий продукта (product_snapshots)
-- Создаёт таблицу для хранения ИИ-генерации стратегии продукта

CREATE TABLE IF NOT EXISTS product_snapshots (
    id              SERIAL PRIMARY KEY,
    launch_id       INTEGER NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
    niche_name      TEXT NOT NULL DEFAULT '',
    positioning     TEXT NOT NULL DEFAULT '',
    usp             TEXT NOT NULL DEFAULT '',
    competitor_diff TEXT NOT NULL DEFAULT '',
    modules         JSONB NOT NULL DEFAULT '[]'::jsonb,
    tariffs         JSONB NOT NULL DEFAULT '[]'::jsonb,
    unit_economics  JSONB NOT NULL DEFAULT '{}'::jsonb,
    methodology     JSONB NOT NULL DEFAULT '{}'::jsonb,
    risks           JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_snapshots_launch_id ON product_snapshots(launch_id);

-- Обновляем stage при генерации продукта
-- (запускается из PHP-кода после успешной генерации)
"