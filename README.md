# ПРОДЮСЕР.AI — сервис ИИ-продюсирования онлайн-курсов

Полный цикл запуска онлайн-курса под управлением AI-агентов: распаковка эксперта → анализ ниши → продукт → лид-магнит и трипваер → воронка → реклама → оплаты → аналитика → корректировка следующего запуска.

**Стек:**

| Слой | Технология |
|------|------------|
| Фронтенд | React 18 + Vite + Tailwind CSS v4 (этот репозиторий) |
| Backend | **PHP 8 на виртуальном хостинге Beget** (папка `public_html/api`), без Functions |
| База данных | **PostgreSQL 16, хост `lipikomoufa.beget.app`** (единственная БД сервиса) |
| ИИ | YandexGPT-5 (Yandex Cloud, `ru-central1`) |
| Аутентификация | JWT (access 15 мин + refresh 30 дней) + bcrypt (cost 12) + rate-limit |
| Платежи | ЮKassa + облачная касса (54-ФЗ) — вебхуки на backend |

---

## Содержание

1. [Модель доступа и безопасность](#1-модель-доступа-и-безопасность)
2. [Структура репозитория](#2-структура-репозитория)
3. [Шаг 1. Beget: сайт + PostgreSQL](#3-шаг-1-beget-сайт--postgresql)
4. [Шаг 2. Переменные окружения (.env)](#4-шаг-2-переменные-окружения-env)
5. [Шаг 3. Миграции БД](#5-шаг-3-миграции-бд)
6. [Шаг 4. Создание владельца (bcrypt)](#6-шаг-4-создание-владельца-bcrypt)
7. [Шаг 5. Composer (phpdotenv)](#7-шаг-5-composer-phpdotenv)
8. [Шаг 6. Yandex Cloud: YandexGPT](#8-шаг-6-yandex-cloud-yandexgpt)
9. [Шаг 7. Сборка и деплой фронтенда](#9-шаг-7-сборка-и-деплой-фронтенда)
10. [API-справочник](#10-api-справочник)
11. [Как фронтенд работает с данными](#11-как-фронтенд-работает-с-данными)
12. [Cron, SMTP, бэкапы](#12-сервисные-задачи)
13. [Troubleshooting](#13-troubleshooting)
14. [Дорожная карта](#14-дорожная-карта)

---

## 1. Модель доступа и безопасность

В коде **нет ни одного пароля** — ни на фронтенде, ни на backend. Проверка идёт только против bcrypt-хэша в таблице `users`.

| Роль | Что видит | Данные |
|------|-----------|--------|
| **Гость** (не вошёл) | Витрина сервиса + экран входа | закрыты |
| **Эксперт** (`role=user`) | Кабинет с реальными данными | PostgreSQL через API |
| **Владелец** (`role=owner`) | + **Мастер-панель** (БД, токены, ключи, чек-лист) | + `PUT /api/data`, `POST /api/launches` |

> Логин владельца — `flinferd` (строчными). Регистр не важен: backend сравнивает `lower(login)`, фронтенд — `toLowerCase()`. Пароль задаётся один раз скриптом (раздел 6) и хранится только в виде bcrypt-хэша.

Механика сессии:

- `POST /api/auth.php` — `password_verify()` против хэша → **access JWT (15 мин)** в теле ответа + **refresh JWT (30 дней)** в `httpOnly; Secure; SameSite=Strict` cookie с путём `/api/auth/`.
- Refresh-токен в БД не хранится открыто — только `sha256`-хэш (`refresh_tokens`), при обновлении токен **ротируется** (старый отзывается).
- **Rate-limit:** 5 неудачных попыток за 15 минут с одного IP → `429` (таблица `login_attempts`).
- `POST /api/auth/refresh` — новый access по refresh-cookie; `POST /api/auth/logout` — отзыв refresh.
- Все остальные эндпоинты требуют `Authorization: Bearer <access>`; общие функции — в `api/auth_helper.php` (`authenticate()` возвращает payload `user_id/login/role` или 401; `requireOwner()` — 403).
- **CORS:** только домен из `ALLOWED_ORIGIN` (без `*`), все запросы с `credentials: include`.
- Все SQL — подготовленные запросы (PDO). Конфигурация — только `.env` (закрыт в `.htaccess`).
- Единый формат ответов: `{ success: true, data: ... }` / `{ success: false, error: "..." }` + коды 200/201/400/401/403/404/405/429/500.

---

## 2. Структура репозитория

```
├── public_html/                ← содержимое копируется в корень сайта на Beget
│   ├── .htaccess               SPA-роутинг + исключение /api + запрет .env
│   ├── .env                    СЕКРЕТЫ (не коммитить!) — см. .env.example
│   ├── .env.example            шаблон
│   ├── index.html, assets/     сборка фронтенда (dist/)
│   └── api/
│       ├── .htaccess           pretty-URL → PHP-скрипты
│       ├── config.php          env (phpdotenv), PDO, CORS, хелперы, дефолты
│       ├── auth_helper.php     JWT HS256, authenticate(), requireOwner(), issueTokens()
│       ├── yandex_gpt.php      callYandexGPT($prompt, $temperature = 0.3)
│       ├── auth.php            вход (bcrypt + rate-limit + JWT)
│       ├── auth/refresh.php    продление access-токена (ротация refresh)
│       ├── auth/logout.php     отзыв refresh-токена
│       ├── launches.php        GET список / POST создание (owner)
│       ├── launches_detail.php GET /launches/{id} (бриф + ниша + план)
│       ├── launches_brief.php  GET/POST бриф; POST генерирует summary в YandexGPT
│       ├── launches_niche.php  GET/POST срез ниши + конкуренты
│       ├── launches_plan.php   GET/POST воронка + тарифы + meta
│       ├── data.php            GET/PUT данные кабинета (app_data, PUT — owner)
│       └── composer.json       vlucas/phpdotenv
├── sql/
│   └── migrations_v2.sql       все таблицы (идемпотентна)
├── scripts/
│   └── create_owner.php        ОДНОРАЗОВЫЙ: владелец с bcrypt-хэшем (cost 12)
└── src/                        React-приложение
    ├── api.ts                  API-клиент (JWT, авто-refresh при 401)
    ├── store.tsx               сессия + реальные данные (без демо-данных)
    └── sections/               разделы кабинета
```

---

## 3. Шаг 1. Beget: сайт + PostgreSQL

1. Виртуальный хостинг Beget с PHP 8.x и расширением **pdo_pgsql** (панель → PHP → расширения; проверить: `<?php phpinfo(); ?>`).
2. Раздел «PostgreSQL» → создать облачную БД:
   - база `flinferd_prod`, пользователь `flinferd_app` (права на все таблицы),
   - хост подключения — **`lipikomoufa.beget.app`**, порт `5432`, SSL обязателен.
3. Домен `producer-ai.ru` привязать к сайту, выпустить бесплатный Lets Encrypt (Разделы → SSL).
4. В phpPgAdmin убедиться, что схема из раздела 5 применена (22+ таблицы).

---

## 4. Шаг 2. Переменные окружения (.env)

`public_html/.env` (создаётся на сервере из `.env.example`):

```ini
APP_ENV=production
ALLOWED_ORIGIN=https://producer-ai.ru

DB_HOST=lipikomoufa.beget.app
DB_PORT=5432
DB_NAME=flinferd_prod
DB_USER=flinferd_app
DB_PASS=<пароль пользователя БД>
DB_SSLMODE=require

# openssl rand -hex 32
JWT_SECRET=<64 hex-символа>
ACCESS_TTL=900          # 15 минут
REFRESH_TTL=2592000     # 30 дней

YC_FOLDER_ID=<folder id>
YANDEX_GPT_API_KEY=<API-ключ сервисного аккаунта>
YC_MODEL=yandexgpt/latest
```

Важные детали подключения к БД (уже учтены в `config.php`):

- SSL включается через `putenv('PGSSLMODE=require')` **до** создания PDO;
- в DSN параметр `sslmode` **не пишется** — иначе PDO бросает `unrecognized configuration parameter`.

---

## 5. Шаг 3. Миграции БД

```bash
psql "postgres://flinferd_app:<пароль>@lipikomoufa.beget.app:5432/flinferd_prod?sslmode=require" \
     -f sql/migrations_v2.sql
```

Или вставьте содержимое `sql/migrations_v2.sql` в SQL-окно phpPgAdmin. Миграция идемпотентна (`IF NOT EXISTS`). Создаёт/докручивает:

`users` (+ уникальный индекс по `lower(login)`), `login_attempts`, `refresh_tokens`, `launches.config jsonb`, `briefs`, `brief_answers`, `niche_snapshots`, `competitors`, `funnel_stages`, `tariffs`, `app_data`.

---

## 6. Шаг 4. Создание владельца (bcrypt)

Пароль **не пишется в код** — передаётся аргументом одноразового скрипта:

```bash
php scripts/create_owner.php '<пароль владельца>'
```

Скрипт:

- хэширует пароль: `password_hash($password, PASSWORD_BCRYPT, ['cost' => 12])`;
- создаёт/обновляет пользователя `flinferd` с `role = 'owner'`;
- **после выполнения удалите файл с сервера.**

Проверка входа: `flinferd` + пароль → access-токен и кабинет владельца.

---

## 7. Шаг 5. Composer (phpdotenv)

```bash
cd public_html/api
composer install
```

Если composer на хостинге недоступен — **ничего ставить не нужно**: `config.php` содержит фолбэк-парсер `.env` с тем же поведением (без интерполяции).

---

## 8. Шаг 6. Yandex Cloud: YandexGPT

1. Console → каталог: запишите **Folder ID** (`b1g…`).
2. Сервисные аккаунты → создать → роль **`ai.languageModels.user`**.
3. У аккаунта → «API-ключ» → создать ключ → запишите (`AQVN…`).
4. Заполните `YC_FOLDER_ID` и `YANDEX_GPT_API_KEY` в `.env`.

Проверка связи:

```bash
curl -X POST https://llm.api.cloud.yandex.net/foundationModels/v1/completion \
  -H "Authorization: Api-Key $YANDEX_GPT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "modelUri": "gpt://'$YC_FOLDER_ID'/yandexgpt/latest",
    "completionOptions": {"stream": false, "temperature": 0.3, "maxTokens": "128"},
    "messages": [{"role": "user", "text": "Скажи: связь есть"}]
  }'
```

Где используется: при `POST /api/launches/{id}/brief` сервер собирает промпт из ответов распаковки (`buildBriefPrompt()`), вызывает `callYandexGPT()` и сохраняет summary в `briefs.summary`. Если YandexGPT не настроен или упал — бриф всё равно сохраняется, в ответе поле `yc: "skipped"` / `"error: ..."`.

---

## 9. Шаг 7. Сборка и деплой фронтенда

```bash
npm install
npm run build
```

На сервер:

```
dist/index.html  → public_html/index.html
dist/assets/     → public_html/assets/   (заменить целиком)
```

Корневой `.htaccess` уже в репозитории (`public_html/.htaccess`): он исключает `/api/*` из SPA-перезаписи и закрывает доступ к `.env`. Если у вас свой рабочий `.htaccess` — добавьте только строку перед SPA-правилом:

```apache
RewriteCond %{REQUEST_URI} !^/api/
```

URL API зашит в `src/api.ts`: `https://producer-ai.ru/api` (константа `API_BASE`).

---

## 10. API-справочник

| Эндпоинт | Метод | Назначение | Авторизация |
|----------|-------|------------|-------------|
| `/api/auth.php` | POST | Вход: bcrypt + rate-limit, выдача JWT-пары | нет |
| `/api/auth/refresh` | POST | Новый access по refresh-cookie (ротация) | cookie |
| `/api/auth/logout` | POST | Отзыв refresh-токена | cookie |
| `/api/launches` | GET | Список запусков | JWT |
| `/api/launches` | POST | Создать запуск `{ name, expert? }` | JWT, **owner** |
| `/api/launches/{id}` | GET | Запуск + бриф + ниша + план | JWT |
| `/api/launches/{id}/brief` | GET/POST | Бриф распаковки; POST вызывает YandexGPT | JWT |
| `/api/launches/{id}/niche` | GET/POST | Срез ниши + конкуренты | JWT |
| `/api/launches/{id}/plan` | GET/POST | Воронка + тарифы + meta (трафик/цена) | JWT |
| `/api/data` | GET | Данные кабинета (app_data: воронка, каналы, интеграции…) | JWT |
| `/api/data` | PUT | Апсерт ключей данных (белый список) | JWT, **owner** |

Примеры:

```bash
# вход
curl -X POST https://producer-ai.ru/api/auth.php \
  -H "Content-Type: application/json" \
  -d '{"login":"flinferd","password":"<пароль>"}' -c cookies.txt
# → { success: true, data: { access_token, token_type, expires_in, user: { id, login, role, name } } }

# список запусков
curl https://producer-ai.ru/api/launches -H "Authorization: Bearer $TOKEN"

# создать запуск (owner)
curl -X POST https://producer-ai.ru/api/launches \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Нейрофотограф 2.0","expert":"Мария Ким"}'

# сохранить бриф (summary сгенерирует YandexGPT)
curl -X POST https://producer-ai.ru/api/launches/1/brief \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"answers":[{"key":"exp","label":"Опыт","value":"6 лет съёмок"},{"key":"aud","label":"Аудитория","value":"селлеры маркетплейсов"}]}'

# данные кабинета
curl https://producer-ai.ru/api/data -H "Authorization: Bearer $TOKEN"
curl -X PUT https://producer-ai.ru/api/data -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"budget":180000}'
```

---

## 11. Как фронтенд работает с данными

- **localStorage хранит только** access-токен (`np_access_token`) и сессионный объект пользователя (`np_session_user`). Бизнес-данных в браузере нет.
- Вход: `LoginForm` → `POST /api/auth.php` → токен + `GET /api/data` → состояние `real` в `store.tsx`.
- Каждый запрос идёт с `Authorization: Bearer …`; при `401` клиент **один раз** вызывает `/api/auth/refresh` (refresh живёт в httpOnly-cookie, JS его не видит) и повторяет запрос.
- Изменения (`store.set(...)`) сразу видны в UI и асинхронно уходят `PUT /api/data` (владелец).
- Разделы «Обзор», «Воронка», «Реклама», «Оплаты», «Статистика» для гостя показывают заглушку «войдите» — демо-данных в проекте больше нет.
- Запуски в кабинете — `GET /api/launches`; создание — `POST /api/launches` (владелец).

---

## 12. Сервисные задачи

- **Cron** (панель Beget → Cron): цикл оркестратора `*/15 * * * *`, ночная сверка реестра `0 3 * * *`, чистка `login_attempts` и отозванных `refresh_tokens` `0 4 * * *`.
- **SMTP:** почта домена для писем ученикам (доступы, напоминания).
- **Бэкапы:** ежедневные снапшоты PostgreSQL в панели Beget + внешняя копия.
- **Мониторинг:** алерты о `5xx` на `/api/*` владельцу в Telegram.

---

## 13. Troubleshooting

| Симптом | Причина / решение |
|---------|-------------------|
| `SQLSTATE[0A000]: unrecognized configuration parameter "sslmode"` | `sslmode` попал в DSN. Уберите его из DSN — SSL задаётся `putenv('PGSSLMODE=require')` до PDO (в `config.php` уже так). |
| `could not find driver` | Не включён `pdo_pgsql`: панель Beget → PHP → расширения. |
| `401 Токен недействителен или истёк` | Access протух; фронтенд сам делает refresh. Если повторяется — проверьте `JWT_SECRET` (одинаковый на всех процессах) и время сервера. |
| `429 Слишком много неудачных попыток` | Сработал rate-limit. Подождите 15 минут или очистите `login_attempts` для теста. |
| Вход не проходит сразу после миграций | Владелец не создан: выполните `php scripts/create_owner.php '<пароль>'`. |
| `404` на `/api/launches` (возвращается HTML) | SPA-правило перехватывает `/api`. Добавьте `RewriteCond %{REQUEST_URI} !^/api/` в корневой `.htaccess` (раздел 9). |
| CORS-ошибка в консоли | Домен не совпадает с `ALLOWED_ORIGIN` в `.env` (протокол и www важны). |
| YandexGPT: `401/403` | API-ключ без роли `ai.languageModels.user` или чужой Folder ID в `modelUri`. |
| `.env` виден по прямой ссылке | Проверьте блок `<FilesMatch "^\.env">` в корневом `.htaccess`. |
| Изменения не сохраняются | `PUT /api/data` доступен только owner; проверьте роль в JWT (`role: owner`). |

---

## 14. Дорожная карта

- **v0.9 (сейчас):** JWT/bcrypt-аутентификация, запуски, бриф с YandexGPT-суммаризацией, ниша, план, данные кабинета из PostgreSQL.
- **v1.0:** вебхуки ЮKassa → `app_data.txs` и `payments`; расчёт KPI финконтролем в `app_data.kpis`; медиабаер через VK Ads API / Директ API.
- **v1.5:** агент распаковки ведёт диалог через backend (YandexGPT streaming), события в `events` для сквозной аналитики.
- **v2.0:** ведение курса (уроки, прогресс, ИИ-куратор), максимайзер, когортный LTV.
