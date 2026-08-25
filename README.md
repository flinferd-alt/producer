# ПРОДЮСЕР.AI — сервис ИИ-продюсирования онлайн-курсов

Полный цикл запуска онлайн-курса под управлением AI-агентов на **YandexGPT (Yandex Cloud)** с единой базой данных **PostgreSQL на хостинге Beget**:
распаковка эксперта → анализ ниши и конкурентов → продукт и тарифы → лид-магнит и трипваер → воронка → реклама (VK Реклама, Яндекс Директ, Telegram Ads) → оплаты (ЮKassa, чеки 54-ФЗ) → аналитика → корректировка следующего запуска.

- **Фронтенд**: React 18 + Vite + Tailwind CSS v4 (этот репозиторий)
- **База данных**: PostgreSQL 16 на Beget (единственная БД сервиса)
- **ИИ**: YandexGPT-5, YandexART (Yandex Cloud, зона `ru-central1`)
- **Backend/API**: Beget Functions (serverless Node.js) — авторизация, вебхуки, cron-агенты
- **Платежи**: ЮKassa + облачная касса (54-ФЗ)

---

## Содержание

1. [Архитектура](#1-архитектура)
2. [Модель доступа: демо → реальные → владелец](#2-модель-доступа-демо--реальные-данные--владелец)
3. [Шаг 1. Beget: сайт + PostgreSQL](#3-шаг-1-beget-сайт--postgresql)
4. [Шаг 2. Схема базы данных (SQL)](#4-шаг-2-схема-базы-данных)
5. [Шаг 3. Yandex Cloud: YandexGPT и секреты](#5-шаг-3-yandex-cloud)
6. [Шаг 4. Токены интеграций](#6-шаг-4-токены-интеграций)
7. [Шаг 5. Backend на Beget Functions](#7-шаг-5-backend-на-beget-functions)
8. [Шаг 6. Сборка и публикация фронтенда](#8-шаг-6-сборка-и-публикация-фронтенда)
9. [Шаг 7. Cron, SMTP, бэкапы, мониторинг](#9-шаг-7-сервисные-задачи)
10. [Безопасность и соответствие законам](#10-безопасность)
11. [Кабинет: где что настраивается](#11-кабинет)
12. [Troubleshooting](#12-troubleshooting)
13. [Дорожная карта](#13-дорожная-карта)

---

## 1. Архитектура

```
┌─────────────────┐    ┌──────────────────────┐    ┌────────────────────────┐
│  Telegram-бот   │    │  Web-кабинет (React)  │    │  Лендинги воронок      │
└────────┬────────┘    └──────────┬───────────┘    └───────────┬────────────┘
         │                        │  HTTPS                     │
         ▼                        ▼                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Beget Functions (Node.js): /api/auth, /api/launches, /api/webhooks,   │
│  /api/cron/* — авторизация (JWT), бизнес-логика, вызовы YandexGPT      │
└───────┬───────────────────────┬──────────────────────────┬─────────────┘
        │ SQL (SSL)             │ HTTPS                    │ HTTPS
        ▼                       ▼                          ▼
┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐
│ Beget PostgreSQL │  │ Yandex Cloud:    │  │ VK Ads API · Директ API · │
│ 16 — единая БД   │  │ YandexGPT-5,     │  │ ЮKassa · Telegram ·       │
│ (24 таблицы)     │  │ Lockbox, IAM     │  │ Яндекс Метрика            │
└──────────────────┘  └──────────────────┘  └───────────────────────────┘
```

**Правило данных:** все цифры (лиды, платежи, ROMI) читаются только из PostgreSQL. YandexGPT лишь интерпретирует их и формулирует решения — так закрывается риск «галлюцинаций в цифрах».

---

## 2. Модель доступа: демо → реальные данные → владелец

Сервис работает в трёх режимах, которые переключаются входом в «Кабинет»:

| Режим | Кто видит | Данные | Что доступно |
|-------|-----------|--------|--------------|
| **Демо** | Гость (не вошёл) | Статичные демо-данные | Все 13 разделов; изменения не сохраняются |
| **Реальные данные** | Эксперт (вошёл) | Из PostgreSQL (`localStorage` в прототипе) | KPI, воронка, реклама, оплаты — правки сохраняются |
| **Владелец** | Владелец (вошёл) | Реальные + боевые настройки | Всё выше + **Мастер-панель**: базы Beget, токены Yandex Cloud, ключи, production-чеклист |

Учётные записи (в прототипе — на клиенте, в `src/store.tsx`):

| Роль | Логин | Пароль |
|------|-------|--------|
| Эксперт (реальные данные) | `expert` | `neuro2026` |
| **Владелец** (+ мастер-панель) | `flinferd` | `$Flin914101$` |

> **Правило проекта:** логин владельца везде пишется строчными — `flinferd` (PHP-скрипты, константа `OWNER_LOGIN` в `src/store.tsx`, кнопка «подставить», значения в localStorage). Проверка нечувствительна к регистру: `strtolower($login) === 'flinferd'` на backend, `login.toLowerCase()` на фронтенде. Для отображения в UI backend возвращает `login: "Flinferd"` с большой буквы.

- Гость видит в шапке плашку **«ДЕМО-ДАННЫЕ»**, эксперт — **«LIVE · реальные данные»**, владелец — **«ВЛАДЕЛЕЦ · LIVE»**.
- Раздел **«Мастер-панель»** появляется в меню только у владельца (иконка-корона); у эксперта вместо него — заглушка «доступно только владельцу».
- Смена роли доступна кнопкой **«Выйти»** в кабинете.

### Backend: PHP API на Beget (уже в работе)

Вход и данные кабинета идут через реальные PHP-эндпоинты в `public_html/api/`:

| Эндпоинт | Метод | Назначение |
|----------|-------|------------|
| `/api/auth.php` | POST `{login, password}` | Проверка владельца, выдача токена |
| `/api/launches.php` | GET | Запуски из таблицы `launches` |

Ключевые детали подключения к облачной PostgreSQL Beget (соблюдены в обоих файлах):

- хост — **приватный IP `10.16.0.1`** (не публичный хост — так быстрее и не тарифицируется внешний трафик);
- SSL включается через `putenv("PGSSLMODE=require")` **до** создания PDO; в DSN параметр `sslmode` не пишется (иначе PDO бросает «unrecognized configuration parameter»);
- токен сессии — `bin2hex(openssl_random_pseudo_bytes(32))` (на хостинге старая версия PHP, `random_bytes` может отсутствовать);
- фронтенд сохраняет `pa_token` и `pa_user` в localStorage; при «Выйти» они удаляются;
- если API недоступен (локальная разработка, сеть), фронтенд делает fallback: вход по локальным константам, запуски — демо-массив `LAUNCHES` из `src/data.ts` (поэтому он не удаляется).

> ⚠️ **Что усилить перед публичным запуском** (раздел [«Безопасность»](#10-безопасность)):
> 1. В таблицу `users` закладывается **bcrypt-хэш** пароля (никогда не открытый текст и не MD5), роль — в колонке `role` (`user` / `owner`).
> 2. Токен из `auth.php` заменить на **JWT с ролью** (access 15 мин + refresh 30 дней, httpOnly-cookie), проверку токена вынести в таблицу `sessions`.
> 3. Rate-limit: 5 неудач → блокировка IP на 15 минут.
> 4. В коде фронтенда константы `OWNER_LOGIN` / `OWNER_PASS` в `src/store.tsx` **удаляются** (локальный fallback отключается), доступ к мастер-разделам проверяется по `role` из JWT и на backend.

Смена пароля сейчас: правится строка в `public_html/api/auth.php` (и `OWNER_PASS` в `src/store.tsx` для локального fallback). После перехода на `users` + bcrypt — только хэш в БД.

---

## 3. Шаг 1. Beget: сайт + PostgreSQL

1. **Тариф.** Подойдёт виртуальный хостинг с PostgreSQL или VDS (рекомендуется VDS от 2 ГБ RAM: PostgreSQL + Functions + фронтенд).
2. **Домен и SSL.** Привяжите домен (например, `flinferd.ru`) в панели → *Домены и поддомены*. Выпустите бесплатный Let's Encrypt: *SSL-сертификаты → Let's Encrypt → выпустить для домена и www*.
3. **Создание БД.** Панель Beget → *PostgreSQL* (или *Базы данных → PostgreSQL*):
   - создайте базу `flinferd_prod`;
   - создайте пользователя `flinferd_app` с надёжным паролем (24+ символов, сгенерируйте в менеджере паролей);
   - выдайте пользователю права только на эту базу;
   - включите **внешний доступ по SSL** и добавьте в белый список IP вашего VDS с Functions.
4. **Данные подключения** (понадобятся для `.env`):
   ```
   Хост:       flinferd.beget.tech   (уточните в панели — может быть вида flinferd.ru или vds-xxxx)
   Порт:       5432
   База:       flinferd_prod
   Пользователь: flinferd_app
   SSL:        обязателен (?sslmode=require)
   ```
5. **Проверка.** В панели откройте **phpPgAdmin**, войдите под `flinferd_app` — если таблицы видны, доступ работает. Из терминала:
   ```bash
   psql "postgres://flinferd_app:ПАРОЛЬ@flinferd.beget.tech:5432/flinferd_prod?sslmode=require" -c "select now();"
   ```

---

## 4. Шаг 2. Схема базы данных

Выполните скрипт целиком в **phpPgAdmin** (вкладка *SQL*) или через `psql -f schema.sql`. 24 таблицы закрывают весь цикл: распаковка, продукт, воронка, трафик, платежи, агенты, настройки.

```sql
-- ============================================================
-- ПРОДЮСЕР.AI · schema.sql · PostgreSQL 16 (Beget)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Автообновление updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ---------- пользователи и сессии ----------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  login         text UNIQUE NOT NULL,
  password_hash text NOT NULL,              -- bcrypt, cost 12
  role          text NOT NULL DEFAULT 'owner',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_attempts (
  id         bigserial PRIMARY KEY,
  login      text NOT NULL,
  ip         inet,
  success    boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Вставка владельца (хэш сгенерируйте: htpasswd -bnBC 12 "" '$Flin914101$' | tr -d ':\n')
-- INSERT INTO users (login, password_hash) VALUES ('Flinferd', '<ВСТАВЬТЕ_ХЭШ>');

-- ---------- запуски ----------
CREATE TABLE launches (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  expert      text,
  stage       text NOT NULL DEFAULT 'распаковка',
  status      text NOT NULL DEFAULT 'планирование',  -- планирование|активен|завершён
  template_id uuid REFERENCES launches(id),          -- шаблон предыдущего запуска
  config      jsonb NOT NULL DEFAULT '{}',           -- параметры воронки, тарифов
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- распаковка (бриф) ----------
CREATE TABLE briefs (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id  uuid NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  version    int  NOT NULL DEFAULT 1,
  summary    jsonb NOT NULL DEFAULT '{}',   -- итоговый бриф от ИИ
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brief_answers (
  id        bigserial PRIMARY KEY,
  brief_id  uuid NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  q_key     text NOT NULL,                  -- niche|expertise|audience|pain|...
  question  text NOT NULL,
  answer    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- ниша и конкуренты ----------
CREATE TABLE niche_snapshots (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id  uuid NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  score      int,
  demand     int,                           -- показов/мес (Wordstat)
  growth_pct numeric(5,1),
  verdict    text,
  data       jsonb NOT NULL DEFAULT '{}',   -- swot, сегменты, цены
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE competitors (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id    uuid NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  name         text NOT NULL,
  students     int,
  avg_check    int,
  rating       numeric(3,1),
  power        int,                          -- 0..100
  weak_point   text,
  scanned_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- продукт ----------
CREATE TABLE modules (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id  uuid NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  position   int NOT NULL,
  title      text NOT NULL,
  variant    text NOT NULL DEFAULT 'A'       -- A|B (сборки программы)
);

CREATE TABLE lessons (
  id        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  position  int NOT NULL,
  title     text NOT NULL,
  duration  int                              -- минуты
);

CREATE TABLE tariffs (
  id        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id uuid NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  name      text NOT NULL,
  kind      text NOT NULL DEFAULT 'core',    -- leadmagnet|tripwire|core|maximizer
  price     int  NOT NULL,
  features  jsonb NOT NULL DEFAULT '[]',
  is_hot    boolean NOT NULL DEFAULT false
);

-- ---------- воронка ----------
CREATE TABLE funnel_stages (
  id        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id uuid NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  stage_key text NOT NULL,                   -- reg|show|stay|buy|trip
  value     numeric(6,2) NOT NULL,
  bench     numeric(6,2) NOT NULL
);

CREATE TABLE funnel_snapshots (
  id         bigserial PRIMARY KEY,
  launch_id  uuid NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  clicks     int, registrations int, showed int, stayed int, sales int, trip_sales int,
  revenue    numeric(12,2), spend numeric(12,2), romi numeric(8,1),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- трафик ----------
CREATE TABLE campaigns (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id  uuid NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  channel    text NOT NULL,                  -- vk|direct|tg_ads|posevy
  ext_id     text,                           -- id кампании в кабинете площадки
  name       text NOT NULL,
  budget     numeric(12,2),
  status     text NOT NULL DEFAULT 'активна',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ad_stats_daily (
  id          bigserial PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  day         date NOT NULL,
  spend       numeric(12,2), impressions int, clicks int, leads int, cpl numeric(10,2),
  UNIQUE (campaign_id, day)
);

CREATE TABLE leads (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id   uuid NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id),
  contact     text,                          -- телефон/tg/email (шифруется в prod)
  segment     text,
  source      text, utm jsonb, click_id text,
  status      text NOT NULL DEFAULT 'новый', -- новый|прогрев|горячий|купил|отказ
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- платежи ----------
CREATE TABLE payments (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id    uuid NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  lead_id      uuid REFERENCES leads(id),
  tariff_id    uuid REFERENCES tariffs(id),
  yookassa_id  text UNIQUE,
  amount       numeric(12,2) NOT NULL,
  status       text NOT NULL DEFAULT 'в обработке', -- успешно|в обработке|возврат
  method       text,
  receipt_sent boolean NOT NULL DEFAULT false,      -- чек 54-ФЗ
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------- события (сквозная аналитика) ----------
CREATE TABLE events (
  id         bigserial PRIMARY KEY,
  launch_id  uuid REFERENCES launches(id) ON DELETE CASCADE,
  name       text NOT NULL,                  -- lp_view|register|webinar_join|purchase...
  payload    jsonb NOT NULL DEFAULT '{}',
  session_id text, click_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_launch_time ON events (launch_id, created_at DESC);

-- ---------- агенты ----------
CREATE TABLE agent_tasks (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  launch_id  uuid REFERENCES launches(id) ON DELETE CASCADE,
  agent      text NOT NULL,                  -- orch|analyst|copy|media|sales|support|fin|art
  title      text NOT NULL,
  status     text NOT NULL DEFAULT 'в очереди', -- в очереди|в работе|готово|ошибка
  needs_approval boolean NOT NULL DEFAULT false,
  approved   boolean,
  result     jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_logs (
  id         bigserial PRIMARY KEY,
  agent      text NOT NULL,
  level      text NOT NULL DEFAULT 'info',
  message    text NOT NULL,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- настройки и секреты ----------
CREATE TABLE integrations (
  id      serial PRIMARY KEY,
  name    text UNIQUE NOT NULL,              -- ЮKassa|VK Реклама API|...
  enabled boolean NOT NULL DEFAULT false,
  config  jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE tokens (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider     text NOT NULL,                -- yandex_cloud|vk_ads|direct|yookassa|telegram
  label        text NOT NULL,
  value_enc    bytea NOT NULL,               -- pgp_sym_encrypt(value, ключ из окружения)
  created_at   timestamptz NOT NULL DEFAULT now(),
  rotated_at   timestamptz
);

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- триггеры updated_at ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','launches','briefs','campaigns','leads','payments',
                           'agent_tasks','funnel_stages','settings','integrations']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;
```

**Сиды после наката схемы:**

```sql
INSERT INTO integrations (name, enabled) VALUES
 ('Beget PostgreSQL', true), ('ЮKassa', false), ('VK Реклама API', false),
 ('Яндекс Директ API', false), ('Яндекс Метрика', false), ('Telegram Bot API', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO settings (key, value) VALUES
 ('unit_economics', '{"budget":150000,"target_sales":60,"reserve_refund_pct":5}'),
 ('agent_limits',   '{"ycgpt_daily_rub":1500,"vk_daily_rub":8000,"direct_daily_rub":6000}');
```

---

## 5. Шаг 3. Yandex Cloud

1. **Каталог (folder).** console.cloud.yandex.ru → создайте каталог, например `neuroprod`. Скопируйте **Folder ID** (`b1g…`) — это переменная `YC_FOLDER_ID`.
2. **Сервисный аккаунт.** IAM → сервисные аккаунты → создайте `neuroprod-agent`, роль `ai.languageModels.user` (для YandexGPT).
3. **API-ключ.** У сервисного аккаунта → *API-ключи → создать* → `YANDEX_GPT_API_KEY`. Проверка:
   ```bash
   curl -X POST https://llm.api.cloud.yandex.net/foundationModels/v1/completion \
     -H "Authorization: Api-Key $YANDEX_GPT_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"modelUri":"gpt://<FOLDER_ID>/yandexgpt/latest","completionOptions":{"temperature":0.3},
          "messages":[{"role":"user","text":"Скажи: продюсер на связи"}]}'
   ```
4. **Lockbox** (рекомендуется для всех секретов): создайте секрет `neuroprod-secrets` с ключами `db_password`, `yookassa_secret`, `vk_ads_token`, `direct_oauth`, `tg_bot_token`. Backend читает их из Lockbox при старте — в `.env` лежит только сервисный ключ доступа.
5. **YandexART** (арт-директ агент): включите доступ к Kandinsky в том же каталоге, отдельный ключ не нужен — авторизация через IAM сервисного аккаунта.

---

## 6. Шаг 4. Токены интеграций

Все токены вносятся в кабинете (раздел *Кабинет → Токены и ключи*) и дублируются в `.env` backend.

| Сервис | Где получить | Переменная |
|---|---|---|
| **VK Реклама** | ads.vk.com → кабинет → *Инструменты → API* → токен с правами на кампании и статистику | `VK_ADS_TOKEN` |
| **Яндекс Директ** | OAuth: `https://oauth.yandex.ru/authorize?response_type=code&client_id=<APP_ID>` → обменять код на токен; приложение регистрируется на oauth.yandex.ru с правами *Директ: управление кампаниями* | `DIRECT_OAUTH` |
| **ЮKassa** | Личный кабинет ЮKassa → *Интеграция → ключи API* (сначала тестовые `test_…`, затем боевые `live_…`) | `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET` |
| **Telegram** | @BotFather → `/newbot` → токен | `TELEGRAM_BOT_TOKEN` |
| **Яндекс Метрика** | OAuth-токен с правом `metrika:read` + номер счётчика | `METRIKA_TOKEN`, `METRIKA_COUNTER` |
| **SMTP** | Панель Beget → *Почта* → создайте `no-reply@ваш-домен`, в настройках функции включите SMTP | `SMTP_USER`, `SMTP_PASS` |

**Вебхук ЮKassa** (после публикации backend): в кабинете ЮKassa → *Интеграция → Уведомления* → укажите
`https://ваш-домен/api/webhooks/yookassa`, отметьте события `payment.succeeded`, `payment.canceled`, `refund.succeeded`.

---

## 7. Шаг 5. Backend на Beget Functions

Beget Functions — serverless-функции Node.js в панели хостинга (*Функции*). Минимальный каркас (один файл на роут):

```
functions/
├─ auth-login/index.js        # POST /api/auth/login
├─ auth-refresh/index.js
├─ launch-list/index.js       # GET  /api/launches (JWT)
├─ brief-save/index.js        # POST /api/briefs   (JWT)
├─ webhook-yookassa/index.js  # POST /api/webhooks/yookassa (подпись!)
├─ cron-orchestrator/index.js # GET  /api/cron/orchestrator (секретный заголовок)
└─ package.json               # зависимости: pg, bcrypt, jsonwebtoken
```

**Пример `auth-login/index.js`:**

```js
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // postgres://...?sslmode=require
  ssl: { rejectUnauthorized: true },
});

exports.handler = async (req) => {
  const { login, password } = JSON.parse(req.body || "{}");
  const ip = req.headers["x-forwarded-for"] || "0.0.0.0";

  // rate-limit: 5 неудач за 15 минут
  const blocked = await pool.query(
    `SELECT count(*) c FROM login_attempts
     WHERE login=$1 AND success=false AND created_at > now() - interval '15 minutes'`, [login]);
  if (Number(blocked.rows[0].c) >= 5)
    return { statusCode: 429, body: JSON.stringify({ error: "Слишком много попыток" }) };

  const r = await pool.query(`SELECT id, password_hash FROM users WHERE login=$1`, [login]);
  const ok = r.rows.length === 1 && (await bcrypt.compare(password, r.rows[0].password_hash));
  await pool.query(`INSERT INTO login_attempts (login, ip, success) VALUES ($1,$2,$3)`, [login, ip, ok]);
  if (!ok) return { statusCode: 401, body: JSON.stringify({ error: "Неверный логин или пароль" }) };

  const access = jwt.sign({ sub: r.rows[0].id, role: "owner" }, process.env.JWT_SECRET, { expiresIn: "15m" });
  const refresh = jwt.sign({ sub: r.rows[0].id, typ: "refresh" }, process.env.JWT_SECRET, { expiresIn: "30d" });
  return { statusCode: 200, headers: { "Set-Cookie": `refresh=${refresh}; HttpOnly; Secure; SameSite=Strict; Path=/` }, body: JSON.stringify({ access }) };
};
```

**`.env` функции** (панель Beget → Функция → Переменные окружения):

```
DATABASE_URL=postgres://flinferd_app:ПАРОЛЬ@ХОСТ:5432/flinferd_prod?sslmode=require
JWT_SECRET=<64 случайных символа>
YC_FOLDER_ID=b1g…
YANDEX_GPT_API_KEY=AQVN…
VK_ADS_TOKEN=vkad…
DIRECT_OAUTH=ydir…
YOOKASSA_SHOP_ID=482913
YOOKASSA_SECRET=live_…
TELEGRAM_BOT_TOKEN=…
SMTP_USER=no-reply@ваш-домен
SMTP_PASS=…
```

**Вебхук ЮKassa** обязан проверять подпись (HTTP Basic Auth с `shopId:secret` из уведомления) и идемпотентно обновлять `payments.status` по `yookassa_id`.

---

## 8. Шаг 6. Сборка и публикация фронтенда

```bash
npm install
npm run build        # результат в dist/
```

1. Панель Beget → *Менеджер файлов* → откройте каталог сайта `ваш-домен/public_html`.
2. Загрузите **содержимое** `dist/` (index.html + assets/) в `public_html`.
3. SPA-роутинг: создайте `public_html/.htaccess`:
   ```apache
   RewriteEngine On
   RewriteBase /
   RewriteRule ^index\.html$ - [L]
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule . /index.html [L]
   ```
4. Укажите API: создайте `.env.production` **до сборки**:
   ```
   VITE_API_URL=https://ваш-домен/api
   ```
5. Проверьте HTTPS (замок в браузере) и что `https://ваш-домен` открывает обзор запуска.

> Обновление сервиса: локально `npm run build` → заменить файлы в `public_html`. База и функции при этом не затрагиваются.

---

## 9. Шаг 7. Сервисные задачи

**Cron** (панель Beget → *Cron* либо функция-планировщик):

```cron
*/15 * * * *  curl -fsS -H "X-Cron-Secret: $CRON_SECRET" https://ваш-домен/api/cron/orchestrator   # цикл оркестратора
0 3 * * *     curl -fsS -H "X-Cron-Secret: $CRON_SECRET" https://ваш-домен/api/cron/night-audit    # сверка реестра ЮKassa
30 3 * * *    pg_dump "$DATABASE_URL" | gzip > /home/USER/backups/db-$(date +\%F).sql.gz           # nightly-бэкап
```

**Бэкапы:** в панели Beget включите автоматические снапшоты (для VDS) + nightly `pg_dump` выше + раз в неделю копируйте архив во внешнее облако (Object Storage).

**SMTP:** создайте почту домена, в функции рассылок укажите SMTP Beget (`smtp.ваш-домен:465, SSL`).

**Мониторинг:** функция `/api/cron/night-audit` при аномалиях (ROMI < 100%, ошибки вебхуков, падение агентов) шлёт алерт владельцу через Telegram-бота.

---

## 10. Безопасность

- [ ] Пароль владельца — **только bcrypt-хэш** в `users`; из фронтенда строки `OWNER_LOGIN`/`OWNER_PASS` удалены.
- [ ] JWT: access 15 мин, refresh в httpOnly-cookie, ротация refresh-токенов.
- [ ] Rate-limit на `/api/auth/login` (5 попыток / 15 мин), логирование в `login_attempts`.
- [ ] `DATABASE_URL` и ключи — **только в переменных окружения функций**, никогда не в git и не в бандле фронтенда.
- [ ] Токены интеграций в БД шифруются: `pgp_sym_encrypt(value, current_setting('app.secret_key'))`, ключ — из окружения.
- [ ] Доступ к PostgreSQL — только по SSL и IP-вайтлисту (VDS с функциями).
- [ ] **152-ФЗ:** чекбоксы согласий на всех лендингах, политика обработки ПДн, хранение ПДн в РФ (Beget — дата-центры в Москве/СПб), регистрация оператора ПДн в Роскомнадзоре.
- [ ] **54-ФЗ:** облачная касса через ЮKassa, чек на каждую оплату/возврат, поле `payments.receipt_sent`.
- [ ] Оферта: что считается оказанной услугой, условия возврата (резерв 5% в `settings.unit_economics`).
- [ ] Ежеквартальная ротация токенов (`tokens.rotated_at`).

---

## 11. Кабинет

Вход: *Кабинет* в меню (значок замка) → логин `Flinferd`, пароль владельца. Внутри:

| Блок | Что делает |
|---|---|
| **Базы данных** | Подключение PostgreSQL Beget (хост/порт/база/пользователь/SSL), пинг, отключение |
| **Токены и ключи** | Добавление/отзыв токенов Yandex Cloud, VK Ads, Директа, ЮKassa, Telegram |
| **Интеграции** | Включение/выключение сервисов (ЮKassa, VK, Директ, Метрика, Telegram, PostgreSQL) |
| **Production-чеклист** | SSL, миграции, вебхук ЮKassa, cron, SMTP, бэкапы, согласия 152-ФЗ, мониторинг |
| **.env backend** | Список переменных окружения с копированием |
| **Запуски** | Все проекты, прогресс, ROMI, шаблоны от запуска к запуску |

Настройки кабинета в прототипе сохраняются в localStorage браузера; в production читаются из `settings`, `integrations`, `tokens`.

---

## 12. Troubleshooting

| Симптом | Причина / решение |
|---|---|
| `ECONNREFUSED 5432` | Внешний доступ к PostgreSQL не включён в панели Beget, либо IP функции не в вайтлисте |
| `no pg_hba.conf entry … SSL` | Подключение без SSL — добавьте `?sslmode=require` в `DATABASE_URL` |
| Пустая страница после деплоя | Файлы загружены не в `public_html`, или не хватает `.htaccess` для SPA |
| `401 Api-Key` от YandexGPT | Ключ создан не в том каталоге / у аккаунта нет роли `ai.languageModels.user` |
| ЮKassa шлёт уведомления, статусы не меняются | Проверьте подпись вебхука и идемпотентность по `yookassa_id` |
| VK Ads `insufficient permissions` | Токен выдан без прав на управление кампаниями — перевыпустите |
| CORS-ошибки в браузере | В настройках домена функции разрешите origin вашего сайта |
| Лимит генераций YandexGPT | Поднимите `agent_limits.ycgpt_daily_rub` в `settings` или включите кэш типовых генераций |

---

## 13. Дорожная карта

- **MVP (6–8 нед):** распаковка + бриф, анализ ниши, продукт и тарифы, ЮKassa + чеки, базовая статистика и кабинет.
- **v1.0 (+8 нед):** ИИ-медиабаер (VK Ads + Директ), конструктор воронок с авторасчётом, скрипт продаж в Telegram, approval-контур.
- **v2.0 (+12 нед):** шаблоны запусков, максимайзер и когортный LTV, ведение курса (бот-куратор), мультизапуски.

---

© ПРОДЮСЕР.AI · YandexGPT на Yandex Cloud · PostgreSQL на Beget
