"-- Freemium: подписки и лимиты бесплатных запусков
-- Применить после основных миграций: psql -f sql/migration_freemium.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS free_launches_used   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP DEFAULT NULL;

-- Значения subscription_status: 'free' | 'pro' | 'studio'
-- free: 1 запуск бесплатно, далее — оплата
-- pro:  до 3 запусков, неограниченные брифы/ниши
-- studio: без ограничений

-- Для удобства: индекс по статусу подписки
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users (subscription_status);

-- Комментарии
COMMENT ON COLUMN users.subscription_status IS 'free | pro | studio';
COMMENT ON COLUMN users.free_launches_used IS 'Сколько бесплатных запусков использовано';
COMMENT ON COLUMN users.subscription_expires_at IS 'Дата окончания подписки (null = бессрочно для free)';
"