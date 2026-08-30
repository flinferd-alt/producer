-- ============================================================
-- ПРОДЮСЕР.AI — миграция YooKassa: таблица платежей
--   psql "postgres://...@...:5432/flinferd_prod?sslmode=require" \
--        -f sql/migration_yookassa.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
    id              BIGSERIAL PRIMARY KEY,
    yookassa_id     TEXT UNIQUE NOT NULL,
    user_id         INT REFERENCES users (id) ON DELETE SET NULL,
    tariff          VARCHAR(20) NOT NULL,
    amount          NUMERIC(10,2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'RUB',
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    description     TEXT NOT NULL DEFAULT '',
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payments_user_idx   ON payments (user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);
CREATE INDEX IF NOT EXISTS payments_yookassa_idx ON payments (yookassa_id);

COMMENT ON COLUMN payments.yookassa_id IS 'ID платежа в системе YooKassa';
COMMENT ON COLUMN payments.tariff      IS 'pro | studio';
COMMENT ON COLUMN payments.status      IS 'pending | waiting_for_capture | succeeded | canceled';