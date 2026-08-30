-- ============================================================
-- ПРОДЮСЕР.AI — миграция YooKassa v2 (идемпотентная через ALTER)
-- Исполнять после migration_yookassa.sql (или вместо, если были ошибки)
-- ============================================================

-- Создаём таблицу, если не существует (все колонки через ALTER ниже)
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY
);

-- Добавляем колонки по одной, если их нет
ALTER TABLE payments ADD COLUMN IF NOT EXISTS yookassa_id  TEXT UNIQUE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id     INT REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tariff      VARCHAR(20) NOT NULL DEFAULT 'pro';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount      NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency    VARCHAR(3) NOT NULL DEFAULT 'RUB';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status      VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata     JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at     TIMESTAMPTZ;

-- Уникальный约束 на yookassa_id (если ещё не создан)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_yookassa_id_key'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_yookassa_id_key UNIQUE (yookassa_id);
  END IF;
END $$;

-- NOT NULL для yookassa_id (после добавления колонки)
ALTER TABLE payments ALTER COLUMN yookassa_id SET NOT NULL;

-- Индексы
CREATE INDEX IF NOT EXISTS payments_user_idx    ON payments (user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx  ON payments (status);
CREATE INDEX IF NOT EXISTS payments_yookassa_idx ON payments (yookassa_id);

-- Комментарии
COMMENT ON TABLE  payments IS 'Платежи YooKassa';
COMMENT ON COLUMN payments.yookassa_id IS 'ID платежа в системе YooKassa';
COMMENT ON COLUMN payments.tariff      IS 'pro | studio';
COMMENT ON COLUMN payments.status      IS 'pending | waiting_for_capture | succeeded | canceled';
COMMENT ON COLUMN payments.metadata    IS 'JSON: user_id, login, tariff (от YooKassa)';