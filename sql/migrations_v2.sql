-- ============================================================
-- ПРОДЮСЕР.AI — миграция v2: JWT-аутентификация, бриф/ниша/план,
-- данные кабинета. Идемпотентна: можно запускать повторно.
--   psql "postgres://flinferd_app:...@lipikomoufa.beget.app:5432/flinferd_prod?sslmode=require" \
--        -f sql/migrations_v2.sql
-- ============================================================

-- Пользователи (таблица уже существует — докручиваем структуру)
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    login         TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_login_lower_uq ON users (lower(login));

-- Попытки входа (для rate-limit)
CREATE TABLE IF NOT EXISTS login_attempts (
    id         BIGSERIAL PRIMARY KEY,
    ip         TEXT NOT NULL,
    login      TEXT NOT NULL,
    success    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_lookup_idx
    ON login_attempts (ip, lower(login), created_at);

-- Refresh-токены (хранится только sha256-хэш)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_hash_uq ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);

-- Запуски: добавляем jsonb-конфиг (трафик/цена плана)
ALTER TABLE launches ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Бриф распаковки
CREATE TABLE IF NOT EXISTS briefs (
    id         SERIAL PRIMARY KEY,
    launch_id  INT NOT NULL UNIQUE REFERENCES launches (id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'draft',
    summary    TEXT,                       -- summary от YandexGPT
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brief_answers (
    id       BIGSERIAL PRIMARY KEY,
    brief_id INT NOT NULL REFERENCES briefs (id) ON DELETE CASCADE,
    key      TEXT NOT NULL,
    label    TEXT NOT NULL DEFAULT '',
    value    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS brief_answers_brief_idx ON brief_answers (brief_id);

-- Анализ ниши: снимки + конкуренты
CREATE TABLE IF NOT EXISTS niche_snapshots (
    id         SERIAL PRIMARY KEY,
    launch_id  INT NOT NULL REFERENCES launches (id) ON DELETE CASCADE,
    score      INT NOT NULL DEFAULT 0,
    niche_name TEXT NOT NULL DEFAULT '',
    verdict    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS niche_snapshots_launch_idx ON niche_snapshots (launch_id);

CREATE TABLE IF NOT EXISTS competitors (
    id          BIGSERIAL PRIMARY KEY,
    snapshot_id INT NOT NULL REFERENCES niche_snapshots (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    students    INT NOT NULL DEFAULT 0,
    check       INT NOT NULL DEFAULT 0,
    rating      NUMERIC(3,1) NOT NULL DEFAULT 0,
    weak        TEXT NOT NULL DEFAULT '',
    power       INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS competitors_snapshot_idx ON competitors (snapshot_id);

-- План запуска: этапы воронки + тарифы
CREATE TABLE IF NOT EXISTS funnel_stages (
    id        BIGSERIAL PRIMARY KEY,
    launch_id INT NOT NULL REFERENCES launches (id) ON DELETE CASCADE,
    key       TEXT NOT NULL,
    label     TEXT NOT NULL DEFAULT '',
    value     NUMERIC(6,2) NOT NULL DEFAULT 0,
    bench     NUMERIC(6,2) NOT NULL DEFAULT 0,
    ord       INT NOT NULL DEFAULT 0,
    UNIQUE (launch_id, key)
);

CREATE TABLE IF NOT EXISTS tariffs (
    id        BIGSERIAL PRIMARY KEY,
    launch_id INT NOT NULL REFERENCES launches (id) ON DELETE CASCADE,
    name      TEXT NOT NULL,
    price     INT NOT NULL DEFAULT 0,
    note      TEXT NOT NULL DEFAULT '',
    hot       BOOLEAN NOT NULL DEFAULT FALSE,
    features  JSONB NOT NULL DEFAULT '[]'::jsonb,
    ord       INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS tariffs_launch_idx ON tariffs (launch_id);

-- Данные кабинета: key/value jsonb (воронка, каналы, интеграции, токены...)
CREATE TABLE IF NOT EXISTS app_data (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by INT REFERENCES users (id)
);
