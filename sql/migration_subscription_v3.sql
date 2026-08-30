-- ============================================================
-- ПРОДЮСЕР.AI — миграция v3: рекуррентные платежи, отмена, возвраты
-- Исполнять после migration_yookassa_v2.sql и migration_freemium.sql
--   psql "postgres://...@...:5432/...?sslmode=require" \
--        -f sql/migration_subscription_v3.sql
-- ============================================================

-- Колонки для рекуррентных платежей в таблице payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at       TIMESTAMPTZ;

-- Колонка для планирования отмены подписки
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ;

-- Значения subscription_status: 'free' | 'trial' | 'pro' | 'studio'
-- (trial добавлен для пробного периода 7 дней — миграция пункта 6)

-- Индексы для cron-задач
CREATE INDEX IF NOT EXISTS idx_users_subscription_expires
  ON users (subscription_expires_at)
  WHERE subscription_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_subscription_cancel
  ON users (subscription_cancel_at)
  WHERE subscription_cancel_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_method
  ON payments (payment_method_id)
  WHERE payment_method_id IS NOT NULL;

-- Комментарии
COMMENT ON COLUMN payments.payment_method_id IS 'ID сохранённого способа оплаты для рекуррентных платежей YooKassa';
COMMENT ON COLUMN payments.refunded_at        IS 'Дата возврата средств';
COMMENT ON COLUMN users.subscription_cancel_at IS 'Запланированная дата отмены подписки (null = не запланирована)';