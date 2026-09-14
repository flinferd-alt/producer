# ПРОДЮСЕР.AI — платформа ИИ-продюсирования онлайн-курсов

**Версия:** 0.2.6 · **API:** https://producer-ai.ru/api · **Хостинг:** Beget (PHP 8.x + PostgreSQL)

SaaS-платформа для запуска инфопродуктов под управлением ИИ-агентов: от распаковки эксперта и анализа ниши до продуктовой линейки, лид-магнита, трипваера и приёма платежей.

## Что умеет (0.2.x)

- **Распаковка эксперта** — интерактивный бриф → summary от YandexGPT (`stage: unpacking → brief_saved`)
- **Анализ ниши** — Wordstat + конкуренты + сегменты + SWOT → вердикт ИИ (`→ niche_accepted`)
- **Стратегия продукта** — программа, тарифы, юнит-экономика, риски (`→ product`)
- **Лид-магнит** — 3 варианта A/B/C + вердикт ИИ
- **Трипваер** — оффер, цена, OTO, вердикт ИИ (`→ funnel`)
- **Freemium-монетизация** — 1 бесплатный запуск, тариф Pro через ЮKassa, отмена/возврат
- **Auth** — JWT access (15 мин) + refresh (30 дней, httpOnly cookie), регистрация, rate-limit
- **Роли** — `user` / `owner` (мастер-панель)

## Тарифы

| Тариф | Цена | Что входит | Статус подписки |
|---|---|---|---|
| Free | 0 ₽ | 1 запуск, базовые функции | `free` |
| Pro | 4 900 ₽/мес | полный доступ, ИИ-генерации | `pro` (30 дней, авто-понижение по cron) |

Цепочка этапов запуска: `unpacking → brief_saved → niche_accepted → product → funnel → traffic → sales` (разделы Funnel/Ads/Stats/Agents пока на демо-данных).

## Архитектура

```
Браузер (React 18 + Vite SPA)
   │  HTTPS + JWT Bearer (access) + httpOnly cookie (refresh)
   ▼
public_html/api/ — PHP 8.x REST API (PDO, prepared statements)
   │  PDO pgsql + SSL (PGSSLMODE=require)
   ▼
PostgreSQL (Beget) — users, launches, briefs, niche_snapshots, payments, …
   │
   ├──► YandexGPT (llm.api.cloud.yandex.net) — брифы, ниши, продукт, ЛМ, трипваер
   ├──► Wordstat (search_api.php) — частотность запросов ниши
   └──► ЮKassa (api.yookassa.ru) — платежи + webhook с верификацией через API
```

Фронтенд: React 18 / TypeScript / Vite 6 / Tailwind 4 / React Router / Framer Motion / Recharts / @dnd-kit / Lucide.
Бэкенд: PHP 8.x, PDO (PostgreSQL 16, SSL), JWT HS256 (своя реализация), cURL (YandexGPT, ЮKassa), phpdotenv (с fallback-парсером без composer).

## Структура проекта

```
├── src/                        # Фронтенд (React + TS)
│   ├── api.ts                  # HTTP-клиент: JWT, refresh-ротация, все вызовы API
│   ├── store.tsx               # Глобальное состояние (auth + данные + подписка)
│   ├── data.ts                 # Типы, константы, демо-данные
│   ├── ui.tsx                  # UI-кит (Panel, Chip, Reveal, тосты…)
│   └── sections/               # Экраны: Dashboard, Unpack, Niche, ProductStack,
│                               #   Funnel, Growth, Insights, Cabinet, Master…
├── api/                        # Бэкенд → деплой в public_html/api/
│   ├── config.php              # Bootstrap: env, PDO, CORS, JSON-хелперы
│   ├── auth_helper.php         # JWT, authenticate(), роли
│   ├── auth.php                # POST /auth — вход (+rate-limit)
│   ├── auth/                   # register, me, refresh, logout
│   ├── launches*.php           # запуски + brief/niche/plan/product/leadmagnet/tripwire
│   ├── data.php                # данные кабинета (app_data)
│   ├── payments.php            # подписка + платежи ЮKassa (создание, отмена)
│   ├── search_api.php          # Wordstat (частотность ниши)
│   ├── yandex_gpt.php          # интеграция YandexGPT
│   └── webhooks/yookassa.php   # вебхук ЮKassa (v2: верификация через API)
├── sql/                        # миграции (см. ниже)
└── scripts/                    # create_owner.php, cron_downgrade.php
```

## База данных и миграции

Порядок применения (все идемпотентны, можно повторять):

```
1. sql/migrations_v2.sql              # ядро: users, launches, briefs, niche_snapshots, app_data, refresh_tokens…
2. sql/migrations_v3_search.sql        # поиск по таблицам
3. sql/migration_launches_user.sql     # launches.user_id (запуски принадлежат юзеру)
4. sql/migration_freemium.sql          # users: subscription_status, free_launches_used, expires_at
5. sql/migration_yookassa.sql (+_v2)   # таблица payments
6. sql/migration_subscription_v3.sql   # payments: refunded_at, cancel_at, payment_method_id
7. sql/migration_product.sql           # product_snapshots (ИИ-стратегия продукта)
8. sql/migration_leadmagnet_tripwire.sql # leadmagnet_snapshots, tripwire_snapshots
```

Ключевые таблицы:

| Таблица | Назначение |
|---|---|
| `users` | логин, bcrypt-хэш, роль, подписка (status, expires_at, cancel_at, free_launches_used) |
| `launches` | запуски: name, expert, stage, config, **user_id** (владелец) |
| `briefs`, `brief_answers` | бриф распаковки + ответы эксперта |
| `niche_snapshots`, `competitors` | снимки анализа ниши + конкуренты |
| `product_snapshots` | ИИ-стратегия: позиционирование, модули, тарифы, юнит-экономика, риски |
| `leadmagnet_snapshots` | 3 варианта ЛМ A/B/C + вердикт ИИ + recommended_idx |
| `tripwire_snapshots` | оффер трипваера, цены, конверсии, OTO |
| `payments` | платежи ЮKassa: yookassa_id, user_id, tariff, amount, status, metadata, refunded_at |
| `app_data` | key/value JSONB — воронка, каналы, интеграции, токены, чек-лист |
| `refresh_tokens`, `login_attempts` | ротация refresh-токенов, rate-limit входа |

## API Endpoints

База: `https://producer-ai.ru/api` (локально CORS разрешает localhost:3000).

### Auth
| Метод | Endpoint | Описание |
|---|---|---|
| POST | `/auth.php` | вход `{login, password}` (+rate-limit 5/15 мин) |
| POST | `/auth/register` | регистрация `{login, password, name?}` |
| GET | `/auth/me` | профиль: подписка, лимиты, free_launches_used |
| POST | `/auth/refresh` | ротация refresh (httpOnly cookie `np_refresh`) |
| POST | `/auth/logout` | отзыв refresh-токена |

### Запуски и генерации (auth обязателен)
| Метод | Endpoint | Описание |
|---|---|---|
| GET/POST | `/launches` | список / создание `{name, expert?}` (лимит по подписке) |
| GET/PATCH | `/launches/:id` | детали / смена stage |
| GET/POST | `/launches/:id/brief` | бриф: получить / сохранить + YandexGPT summary |
| GET/POST | `/launches/:id/niche` | анализ ниши: Wordstat, конкуренты, SWOT |
| GET/POST | `/launches/:id/plan` | план запуска |
| GET/POST | `/launches/:id/product` | ИИ-стратегия продукта: программа, тарифы, экономика |
| GET/POST | `/launches/:id/leadmagnet` | лид-магнит: 3 варианта + вердикт ИИ |
| GET/POST | `/launches/:id/tripwire` | трипваер: оффер, OTO, вердикт ИИ |
| GET/PUT | `/data` | данные кабинета (app_data) |

### Платежи и подписка
| Метод | Endpoint | Описание |
|---|---|---|
| GET | `/payments` | подписка + история платежей (до 50) |
| POST | `/payments` | создать платёж `{tariff: "pro"}` → `confirmation_url` (редирект на ЮKassa) |
| DELETE | `/payments` | запланировать отмену (deactivation в конце периода) |
| POST | `/webhooks/yookassa` | **вебхук ЮKassa** (v2, см. ниже) |

Формат ответов: `{success: true, …}` / `{success: false, error}`; коды 200/201/400/401/403/404/405/429/500.

## Вебхук ЮKassa (v2 — безопасная версия)

Принимает `payment.succeeded`, `payment.canceled`, `refund.succeeded`. Защита:

1. **Верификация через API** — перед записью в БД объект перезапрашивается у ЮKassa (`GET /v3/payments/{id}` / `/v3/refunds/{id}`), доверяем только ответу API. Тело уведомления не доказательство.
2. **Fail-closed** — API недоступен → HTTP 500, ЮKassa повторит доставку. Без `YOOKASSA_SHOPID/SECRET` в .env вебхук тоже отвечает 500.
3. **Идемпотентность** — подписка активируется только при первом переходе в `succeeded` (транзакция + `WHERE status <> 'succeeded'`); возврат обрабатывается один раз (`WHERE refunded_at IS NULL`). Дубли доставок ничего не ломают.
4. **Сверка суммы** — сумма из API сверяется с payments.amount в БД перед активацией.
5. `payment.canceled` только фиксирует статус — не сбрасывает активную подписку.

Лог: `public_html/logs/yookassa_webhook.log` (рекомендуется закрыть папку от веба).

## Cron (понижение подписок)

`scripts/cron_downgrade.php` — раз в час переводит просроченные подписки в free (инвариант как в `/auth/me`: `status <> 'free' AND expires_at < now() → free`). Атомарный UPDATE — нет гонки с вебхуком. Флаг `--dry` — показать, кого понизит, без записи в БД.

Настройка в Beget (панель → Crontab, раз в час):
```
<путь к php> /home/u/ЛОГИН/scripts/cron_downgrade.php
```
Лог: `scripts/cron_downgrade.log` рядом со скриптом.

## Переменные окружения (.env → корень public_html)

```env
# БД PostgreSQL (Beget)
DB_HOST=…  DB_PORT=5432  DB_NAME=…  DB_USER=…  DB_PASS=…  DB_SSLMODE=require

# JWT
JWT_SECRET=<32+ символов>   ACCESS_TTL=900   REFRESH_TTL=2592000

# YandexGPT
YANDEX_GPT_API_KEY=…   YC_FOLDER_ID=…   YC_MODEL=yandexgpt/latest

# ЮKassa
YOOKASSA_SHOPID=…   YOOKASSA_SECRET=…   YOOKASSA_RETURN_URL=https://producer-ai.ru/?paid=1

# CORS (опционально)
ALLOWED_ORIGINS=https://producer-ai.ru,http://localhost:3000
```

## Разработка

```bash
npm install
npm run dev          # localhost:3000, HMR
npm run typecheck    # проверка TS
npm run build        # сборка в dist/
```

## Деплой (Beget)

```bash
# 1. Миграции (если менялись):
psql "postgres://user:pass@host:5432/db?sslmode=require" -f sql/<migration>.sql

# 2. Фронтенд: npm run build → содержимое dist/ → public_html/
# 3. Бэкенд: api/ → public_html/api/
# 4. .env → корень public_html/  (никогда не коммитить!)
# 5. Владелец (один раз):
php scripts/create_owner.php '<пароль>' && rm scripts/create_owner.php
# 6. Cron понижения подписок: scripts/cron_downgrade.php → сервер (рядом с public_html),
#    задача в Beget Crontab раз в час
```

Правила: код фронтенда на сервере не правится; крупные изменения — только через сборку; вебхук ЮKassa настраивается в ЛК ЮKassa на `https://producer-ai.ru/api/webhooks/yookassa`.

## Структура сервера

```
/home/u/ЛОГИН/
├── scripts/                 # cron_downgrade.php (+ лог), create_owner.php (удалить после запуска)
└── public_html/
    ├── api/                 # PHP-бэкенд
    ├── assets/ + index.html # собранный фронтенд
    ├── logs/                # yookassa_webhook.log (закрыть от веба!)
    └── .env
```

## История версий

| Версия | Что вошло |
|---|---|
| 0.2.0–0.2.5 | freemium, ЮKassa, product/leadmagnet/tripwire (ИИ-генерации), launches.user_id, поиск |
| 0.2.6 | вебхук ЮKassa v2 (верификация, идемпотентность), cron-понижение подписок, README 0.2.x |

## Известные ограничения (roadmap)

- Разделы Funnel / Ads / Stats / Agents — демо-данные, генерация воронки в разработке
- Trial 7 дней описан в миграции, но не реализован
- Рекуррентные платежи — убраны до согласования с ЮMoney (payment_method_id сохраняется)

---

*Актуально для версии 0.2.6. Синхронизировано с CONTEXT.md.*