-- ПРОДЮСЕР.AI — привязка запусков к пользователю
-- Запускается после создания таблиц users и launches

ALTER TABLE launches ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users (id) ON DELETE SET NULL;

-- Индекс для быстрого поиска запусков пользователя
CREATE INDEX IF NOT EXISTS idx_launches_user ON launches (user_id);

-- Привязываем существующие запуски к первому пользователю (владельцу)
-- Если запуски уже есть, назначаем их owner-у
UPDATE launches SET user_id = (SELECT MIN(id) FROM users WHERE role = 'owner') WHERE user_id IS NULL;

-- После миграции можно сделать user_id NOT NULL (опционально)
-- ALTER TABLE launches ALTER COLUMN user_id SET NOT NULL;