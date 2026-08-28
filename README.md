# ПРОДЮСЕР.AI — Платформа ИИ-продюсирования онлайн-курсов 🚀

**Версия документации:** 2.0
**Последнее обновление:** 2025
**Статус:** Production (хостинг Beget + локальная разработка)

---

## 📋 Оглавление

1. [О проекте](#о-проекте)
2. [Архитектура системы](#архитектура-системы)
3. [Технологический стек](#технологический-стек)
4. [Структура проекта](#структура-проекта)
5. [База данных и миграции](#база-данных-и-миграции)
6. [Аутентификация и безопасность](#аутентификация-и-безопасность)
7. [API Endpoints](#api-endpoints)
8. [Фронтенд: компоненты и секции](#фронтенд-компоненты-и-секции)
9. [Интеграция с YandexGPT](#интеграция-с-yandexgpt)
10. [Разработка и деплой](#разработка-и-деплой)
11. [Переменные окружения](#переменные-окружения)
12. [История проекта](#история-проекта)

---

## 📖 О проекте

**ПРОДЮСЕР.AI** — это SaaS-платформа для управления запусками инфопродуктов под управлением AI-агентов. Сервис автоматизирует процесс продюсирования онлайн-курсов: от распаковки эксперта до анализа ниши, построения воронки продаж и оптимизации рекламных кампаний.

### Ключевые возможности

- **Распаковка эксперта** — сбор информации об эксперте через интерактивный бриф
- **AI-анализ ниши** — использование YandexGPT для генерации выводов о рынке и конкурентах
- **Конструктор продуктовой линейки** — создание лид-магнитов, трипваеров и основных продуктов
- **Воронка продаж** — визуализация и оптимизация конверсий на каждом этапе
- **Управление рекламой** — интеграция с VK Реклама и Яндекс Директ
- **Сквозная аналитика** — отслеживание ROMI, CPL, выручки и других метрик
- **AI-агенты** — автономные агенты для медиабаинга, копирайтинга, финконтроля и поддержки
- **Мастер-панель владельца** — полный контроль над пользователями и данными системы

### Роли пользователей

| Роль | Описание | Доступ |
|------|----------|--------|
| `guest` | Неавторизованный пользователь | Только демо-режим |
| `user` | Зарегистрированный пользователь | Просмотр и редактирование своих запусков |
| `owner` | Владелец системы | Полный доступ + управление пользователями |

---

## 🏗 Архитектура системы

```
┌─────────────────────────────────────────────────────────────────┐
│                         КЛИЕНТ (Браузер)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              React 18 + Vite SPA (localhost:3000)        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │   App.tsx   │  │  store.tsx  │  │    api.ts       │  │   │
│  │  │  (Routing)  │  │ (Auth+Data) │  │ (HTTP Client)   │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (JWT Bearer Token)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    СЕРВЕР (Beget Hosting)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              public_html/api/ (PHP 8.x REST API)         │   │
│  │  ┌───────────┐  ┌──────────────┐  ┌─────────────────┐  │   │
│  │  │ auth.php  │  │ launches.php │  │   data.php      │  │   │
│  │  │ (+helper) │  │ (+brief/niche│  │ (app_data CRUD) │  │   │
│  │  │  JWT/RBAC │  │     /plan)   │  │                 │  │   │
│  │  └───────────┘  └──────────────┘  └─────────────────┘  │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │              yandex_gpt.php                        │  │   │
│  │  │         (Yandex Cloud API Integration)             │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ PDO (SSL)                        │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           PostgreSQL 16 (Единая БД сервиса)              │   │
│  │  tables: users, launches, briefs, niche_snapshots,      │   │
│  │          funnel_stages, app_data, refresh_tokens...     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ foundationModels v1 API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Yandex Cloud (ru-central1)                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              YandexGPT-5 (yandexgpt/latest)              │   │
│  │         (Генерация брифов, анализ ниши, выводы)          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Поток данных

1. **Клиент → API**: Все запросы идут через `api.ts` с JWT-токеном в заголовке `Authorization: Bearer <token>`
2. **API → БД**: PHP-скрипты используют PDO с prepared statements для защиты от SQL-инъекций
3. **API → YandexGPT**: Синхронные запросы через cURL к `llm.api.cloud.yandex.net`
4. **Refresh-токены**: Хранятся в httpOnly-cookie (`np_refresh`), недоступны для JS

---

## 🛠 Технологический стек

### Фронтенд

| Технология | Версия | Назначение |
|------------|--------|------------|
| **React** | 18.2.0 | UI-библиотека с хуками |
| **TypeScript** | 5.7.0 | Типизация кода |
| **Vite** | 6.3.5 | Сборщик и dev-сервер |
| **Tailwind CSS** | 4.1.7 | Утилитарные стили |
| **React Router DOM** | 6.8.0 | Клиентская маршрутизация |
| **Framer Motion** | 11.16.1 | Анимации интерфейса |
| **Lucide React** | 0.294.0 | Иконки |
| **Recharts** | 2.10.0 | Графики и диаграммы |
| **@dnd-kit** | 6.1.0 | Drag-and-drop функциональность |
| **date-fns** | 2.30.0 | Работа с датами |
| **canvas-confetti** | 1.9.3 | Эффекты празднования |

### Бэкенд

| Технология | Версия | Назначение |
|------------|--------|------------|
| **PHP** | 8.x | REST API логика |
| **PostgreSQL** | 16 | Реляционная БД |
| **PDO** | — | Работа с БД (prepared statements) |
| **vlucas/phpdotenv** | 5.6 | Загрузка .env переменных |
| **cURL** | — | HTTP-запросы к Yandex Cloud API |
| **openssl_random_pseudo_bytes** | — | Генерация криптографических ключей |
| **password_hash/password_verify** | — | BCrypt хеширование паролей |
| **JWT (HS256)** | — | Собственная реализация токенов |

### Инфраструктура

| Компонент | Провайдер | Конфигурация |
|-----------|-----------|--------------|
| **Хостинг** | Beget | VDS, shared hosting |
| **БД** | Beget PostgreSQL | SSL-соединение, ежедневные бэкапы |
| **ИИ-модель** | Yandex Cloud | YandexGPT-5, ru-central1 |
| **SSL** | Let's Encrypt | Бесплатный сертификат |
| **CORS** | Настроен | Разрешены localhost и домен проекта |

---

## 📁 Структура проекта

```
/workspace/
├── README.md                      # Эта документация
├── package.json                   # Зависимости npm и скрипты
├── package-lock.json              # Locked версии зависимостей
├── tsconfig.json                  # Конфигурация TypeScript
├── vite.config.js                 # Конфигурация Vite (порт 3000, HMR)
├── index.html                     # Точка входа SPA
│
├── src/                           # Исходный код фронтенда
│   ├── main.tsx                   # Entry point React-приложения
│   ├── App.tsx                    # Корневой компонент (роутинг, layout)
│   ├── api.ts                     # HTTP-клиент для API (JWT, refresh)
│   ├── store.tsx                  # Глобальное состояние (Auth + Data)
│   ├── data.ts                    # Типы, константы, демо-данные
│   ├── ui.tsx                     # UI-компоненты (кнопки, иконки, тосты)
│   ├── index.css                  # Глобальные стили + Tailwind
│   │
│   └── sections/                  # Секции приложения (по одной на экран)
│       ├── Dashboard.tsx          # Обзор запуска, KPI, лента событий
│       ├── Unpack.tsx             # Распаковка эксперта (бриф)
│       ├── Niche.tsx              # Анализ ниши и конкурентов
│       ├── ProductStack.tsx       # Продуктовая линейка (Product, LeadMagnet, Tripwire)
│       ├── Funnel.tsx             # Воронка продаж с бенчмарками
│       ├── Growth.tsx             # Реклама (AdsSection) и оплаты (PaymentsSection)
│       ├── Insights.tsx           # Статистика (StatsSection) и AI-агенты (AgentsSection)
│       ├── Concept.tsx            # Концепт и архитектура системы
│       ├── Cabinet.tsx            # Личный кабинет (вход/регистрация)
│       └── Master.tsx             # Мастер-панель владельца (только owner)
│
├── api/                           # Бэкенд PHP (размещается в public_html/api/)
│   ├── .htaccess                  # URL rewriting для красивых роутов
│   ├── composer.json              # PHP-зависимости (phpdotenv)
│   ├── config.php                 # Bootstrap: env, PDO, CORS, хелперы
│   ├── auth_helper.php            # JWT encode/decode, authenticate(), роли
│   ├── auth.php                   # POST /auth — вход (login/password)
│   ├── auth/                      # Дополнительные auth-эндпоинты
│   │   ├── refresh.php            # POST /auth/refresh — обновление access-токена
│   │   └── logout.php             # POST /auth/logout — выход (отзыв refresh)
│   ├── launches.php               # GET/POST /launches — список и создание запусков
│   ├── launches_detail.php        # GET /launches/:id — детали запуска
│   ├── launches_brief.php         # GET/POST /launches/:id/brief — бриф распаковки
│   ├── launches_niche.php         # GET/POST /launches/:id/niche — анализ ниши
│   ├── launches_plan.php          # GET/POST /launches/:id/plan — план запуска
│   ├── data.php                   # GET/PUT /data — данные кабинета (app_data)
│   ├── yandex_gpt.php             # Интеграция с YandexGPT API
│   └── test.php                   # Тестовый эндпоинт
│
├── sql/                           # Миграции базы данных
│   └── migrations_v2.sql          # Полная схема БД (идемпотентна)
│
├── scripts/                       # Скрипты для развёртывания
│   └── create_owner.php           # Создание пользователя owner
│
└── producer/                      # (резервная папка, не используется)
```

---

## 🗄 База данных и миграции

### Схема данных (PostgreSQL 16)

#### Таблица `users` — Пользователи
```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    login         TEXT NOT NULL UNIQUE,      -- логин (уникальный, lower-case)
    password_hash TEXT NOT NULL,             -- bcrypt hash (cost 12)
    role          TEXT NOT NULL DEFAULT 'user', -- 'user' | 'owner'
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Таблица `login_attempts` — Rate-limit для входа
```sql
CREATE TABLE login_attempts (
    id         BIGSERIAL PRIMARY KEY,
    ip         TEXT NOT NULL,
    login      TEXT NOT NULL,
    success    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Индекс для быстрого поиска: (ip, lower(login), created_at)
```

#### Таблица `refresh_tokens` — Refresh-токены
```sql
CREATE TABLE refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    INT REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,              -- sha256 хэш токена
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Таблица `launches` — Запуски
```sql
CREATE TABLE launches (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL,               -- название запуска
    expert     TEXT,                        -- имя эксперта
    stage      TEXT NOT NULL DEFAULT 'unpacking', -- текущий этап
    status     TEXT NOT NULL DEFAULT 'active',   -- статус
    config     JSONB NOT NULL DEFAULT '{}',      -- план (трафик, цена, тарифы)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Таблица `briefs` — Бриф распаковки
```sql
CREATE TABLE briefs (
    id         SERIAL PRIMARY KEY,
    launch_id  INT NOT NULL UNIQUE REFERENCES launches(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'draft',
    summary    TEXT,                        -- summary от YandexGPT
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Таблица `brief_answers` — Ответы брифа
```sql
CREATE TABLE brief_answers (
    id       BIGSERIAL PRIMARY KEY,
    brief_id INT NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
    key      TEXT NOT NULL,                 -- ключ вопроса
    label    TEXT NOT NULL DEFAULT '',      -- текст вопроса
    value    TEXT NOT NULL DEFAULT ''       -- ответ эксперта
);
```

#### Таблица `niche_snapshots` — Снимки анализа ниши
```sql
CREATE TABLE niche_snapshots (
    id         SERIAL PRIMARY KEY,
    launch_id  INT NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
    score      INT NOT NULL DEFAULT 0,      -- оценка привлекательности (0-100)
    niche_name TEXT NOT NULL DEFAULT '',
    verdict    TEXT NOT NULL DEFAULT '',    -- вывод AI
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Таблица `competitors` — Конкуренты
```sql
CREATE TABLE competitors (
    id          BIGSERIAL PRIMARY KEY,
    snapshot_id INT NOT NULL REFERENCES niche_snapshots(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    students    INT NOT NULL DEFAULT 0,     -- количество студентов
    check       INT NOT NULL DEFAULT 0,     -- средний чек
    rating      NUMERIC(3,1) NOT NULL DEFAULT 0,
    weak        TEXT NOT NULL DEFAULT '',   -- слабые места
    power       INT NOT NULL DEFAULT 0      -- сила (0-100)
);
```

#### Таблица `funnel_stages` — Этапы воронки
```sql
CREATE TABLE funnel_stages (
    id        BIGSERIAL PRIMARY KEY,
    launch_id INT NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
    key       TEXT NOT NULL,                -- идентификатор этапа
    label     TEXT NOT NULL DEFAULT '',     -- название этапа
    value     NUMERIC(6,2) NOT NULL DEFAULT 0, -- текущая конверсия %
    bench     NUMERIC(6,2) NOT NULL DEFAULT 0, -- бенчмарк отрасли %
    ord       INT NOT NULL DEFAULT 0        -- порядок отображения
);
```

#### Таблица `tariffs` — Тарифы продукта
```sql
CREATE TABLE tariffs (
    id        BIGSERIAL PRIMARY KEY,
    launch_id INT NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
    name      TEXT NOT NULL,
    price     INT NOT NULL DEFAULT 0,
    note      TEXT NOT NULL DEFAULT '',
    hot       BOOLEAN NOT NULL DEFAULT FALSE, -- популярный тариф
    features  JSONB NOT NULL DEFAULT '[]',    -- список преимуществ
    ord       INT NOT NULL DEFAULT 0
);
```

#### Таблица `app_data` — Данные кабинета (key/value)
```sql
CREATE TABLE app_data (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by INT REFERENCES users(id)
);
```
**Ключи:** `funnel`, `traffic`, `price`, `budget`, `ads`, `txs`, `kpis`, `integrations`, `dbConns`, `tokens`, `checklist`

### Применение миграций

```bash
psql "postgres://user:pass@host:5432/dbname?sslmode=require" -f sql/migrations_v2.sql
```

---

## 🔐 Аутентификация и безопасность

### JWT Token Flow

```
┌──────────────┐      POST /auth.php       ┌──────────────┐
│   Клиент     │ ─────────────────────────▶│   Сервер     │
│              │                           │  (auth.php)  │
│              │                           │              │
│  {login,     │                           │  1. Rate-limit│
│   password}  │                           │  2. Verify   │
│              │                           │  3. Issue    │
│              │ ◀─────────────────────────│  tokens      │
│              │  {access_token, user}     │              │
│              │  Set-Cookie: np_refresh   │              │
└──────────────┘                           └──────────────┘
```

### Access Token (15 минут)

- **Тип:** JWT HS256
- **Хранение:** localStorage (`np_access_token`)
- **Payload:**
```json
{
  "type": "access",
  "user_id": 1,
  "login": "flinferd",
  "role": "owner",
  "iat": 1735689600,
  "exp": 1735690500,
  "jti": "a1b2c3d4e5f6..."
}
```

### Refresh Token (30 дней)

- **Тип:** JWT HS256
- **Хранение:** httpOnly-cookie (`np_refresh`), путь `/api/auth/`
- **Ротация:** При каждом использовании выдаётся новый токен
- **Отзыв:** При logout хэш помечается как `revoked_at`

### Rate Limiting

- **Лимит:** 5 неудачных попыток входа за 15 минут с одного IP
- **Таблица:** `login_attempts`
- **Ответ:** HTTP 429 Too Many Requests

### Безопасность

| Мера | Реализация |
|------|------------|
| **Пароли** | bcrypt с cost=12 |
| **SQL-инъекции** | PDO prepared statements |
| **XSS** | React экранирует вывод по умолчанию |
| **CSRF** | SameSite=Strict cookie |
| **HTTPS** | Обязательное SSL-соединение к БД и API |
| **CORS** | Строгий whitelist origins |

---

## 🌐 API Endpoints

### Базовый URL
- **Production:** `https://producer-ai.ru/api`
- **Local:** `https://producer-ai.ru/api` (CORS разрешает localhost:3000)

### Аутентификация

| Метод | Endpoint | Описание | Auth |
|-------|----------|----------|------|
| `POST` | `/auth.php` | Вход (login, password) | ❌ |
| `POST` | `/auth/refresh` | Обновление access-токена | ❌ (cookie) |
| `POST` | `/auth/logout` | Выход (отзыв refresh) | ✅ |

### Запуски

| Метод | Endpoint | Описание | Auth |
|-------|----------|----------|------|
| `GET` | `/launches` | Список всех запусков | ✅ |
| `POST` | `/launches` | Создать запуск `{name, expert?}` | ✅ owner |
| `GET` | `/launches/:id` | Детали запуска | ✅ |
| `GET` | `/launches/:id/brief` | Получить бриф | ✅ |
| `POST` | `/launches/:id/brief` | Сохранить бриф + YandexGPT summary | ✅ |
| `GET` | `/launches/:id/niche` | Получить анализ ниши | ✅ |
| `POST` | `/launches/:id/niche` | Сохранить анализ ниши | ✅ |
| `GET` | `/launches/:id/plan` | Получить план запуска | ✅ |
| `POST` | `/launches/:id/plan` | Сохранить план (воронка, тарифы) | ✅ |

### Данные кабинета

| Метод | Endpoint | Описание | Auth |
|-------|----------|----------|------|
| `GET` | `/data` | Все данные кабинета | ✅ |
| `PUT` | `/data` | Обновить данные `{key: value}` | ✅ owner |

### Формат ответов

**Успех:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Ошибка:**
```json
{
  "success": false,
  "error": "Описание ошибки"
}
```

**HTTP коды:**
- `200` — Успешный GET/PUT
- `201` — Успешное создание (POST)
- `400` — Ошибка валидации
- `401` — Неавторизован
- `403` — Недостаточно прав
- `404` — Не найдено
- `405` — Метод не разрешён
- `429` — Rate limit exceeded
- `500` — Ошибка сервера

---

## 🎨 Фронтенд: компоненты и секции

### Навигация (src/data.ts)

```typescript
NAV = [
  // Запуск
  { id: "dashboard", label: "Обзор", icon: "grid" },
  { id: "unpack", label: "Распаковка", icon: "chat" },
  { id: "niche", label: "Анализ ниши", icon: "target" },

  // Продукт
  { id: "product", label: "Продукт", icon: "layers" },
  { id: "leadmagnet", label: "Лид-магнит", icon: "magnet" },
  { id: "tripwire", label: "Трипваер", icon: "bolt" },

  // Рост
  { id: "funnel", label: "Воронка", icon: "funnel" },
  { id: "ads", label: "Реклама", icon: "mega" },
  { id: "payments", label: "Оплаты", icon: "card" },

  // Данные
  { id: "stats", label: "Статистика", icon: "chart" },
  { id: "agents", label: "AI-агенты", icon: "bot" },

  // Система
  { id: "concept", label: "Концепт и архитектура", icon: "schema" },
  { id: "cabinet", label: "Кабинет", icon: "user" },
  { id: "master", label: "Мастер-панель", icon: "shield" }
]
```

### Описание секций

#### 1. Dashboard (`Dashboard.tsx`)
- **Назначение:** Сводная информация по запуску
- **Компоненты:** KPI карточки (выручка, лиды, CPL, ROMI), лента событий, график динамики
- **Данные:** `KPIS` из store, `FEED` события

#### 2. Unpack (`Unpack.tsx`)
- **Назначение:** Распаковка эксперта через бриф
- **Функционал:** Интерактивные вопросы, сохранение ответов, AI-summary
- **API:** `POST /launches/:id/brief`

#### 3. Niche (`Niche.tsx`)
- **Назначение:** Анализ рынка и конкурентов
- **Функционал:** Оценка привлекательности ниши, таблица конкурентов, AI-verdict
- **API:** `POST /launches/:id/niche`

#### 4. ProductStack (`ProductStack.tsx`)
- **Назначение:** Конструктор продуктовой линейки
- **Компоненты:** `ProductSection`, `LeadMagnetSection`, `TripwireSection`
- **Функционал:** Создание тарифов, описание продуктов

#### 5. Funnel (`Funnel.tsx`)
- **Назначение:** Визуализация воронки продаж
- **Данные:** Этапы с конверсиями и бенчмарками
- **API:** `POST /launches/:id/plan`

#### 6. Growth (`Growth.tsx`)
- **Назначение:** Управление рекламой и оплатами
- **Компоненты:** `AdsSection` (каналы трафика), `PaymentsSection` (транзакции)

#### 7. Insights (`Insights.tsx`)
- **Назначение:** Аналитика и AI-агенты
- **Компоненты:** `StatsSection` (графики), `AgentsSection` (лог действий агентов)

#### 8. Concept (`Concept.tsx`)
- **Назначение:** Документация архитектуры системы
- **Контент:** Диаграммы, описание связей

#### 9. Cabinet (`Cabinet.tsx`)
- **Назначение:** Личный кабинет пользователя
- **Функционал:** Вход/выход, профиль, создание запусков

#### 10. Master (`Master.tsx`)
- **Назначение:** Панель владельца (только `role=owner`)
- **Функционал:** Управление пользователями, системные настройки

### Глобальное состояние (store.tsx)

```typescript
// Auth Context
useAuth() → { session, live, isOwner, login, logout }

// Store Context
useStore() → {
  real,           // Данные из БД
  loaded,         // Флаг загрузки
  set,            // Обновление данных
  refreshData,    // Перезагрузка

  launches,       // Список запусков
  activeLaunchId, // Текущий запуск
  setActiveLaunchId,
  refreshLaunches
}
```

---

## 🤖 Интеграция с YandexGPT

### Конфигурация

```env
YANDEX_GPT_API_KEY=<API-ключ сервисного аккаунта>
YC_FOLDER_ID=<ID каталога облака>
YC_MODEL=yandexgpt/latest  # опционально
```

### Использование

**Файл:** `api/yandex_gpt.php`

```php
// Синхронный вызов модели
$summary = callYandexGPT($prompt, temperature: 0.3, maxTokens: 1024);
```

### Промпт для брифа

```php
buildBriefPrompt($answers) → string
```

**Системная роль:** "Ты — опытный продюсер онлайн-курсов"

**Задача:** По ответам эксперта составить краткий бриф (5-7 предложений):
- Сильные стороны эксперта
- Целевая аудитория
- Главная боль
- Обещание продукта
- Точки роста
- Риски

### Пример ответа

```json
{
  "brief_id": 42,
  "summary": "Эксперт обладает 10-летним опытом в нише... ЦА — женщины 25-45 лет... Главный риск — высокая конкуренция...",
  "yc": "generated"
}
```

---

## 💻 Разработка и деплой

### Локальная разработка

```bash
# 1. Установка зависимостей
npm install

# 2. Запуск dev-сервера (порт 3000, HMR включён)
npm run dev

# 3. Проверка типов TypeScript
npm run typecheck
```

**Dev-сервер:**
- Host: `0.0.0.0`
- Port: `3000`
- HMR port: `3000`
- CORS: разрешён `producer-ai.ru`

### Сборка и деплой

```bash
# 1. Сборка production-версии
npm run build

# 2. Результат в папке dist/
#    - assets/ (JS/CSS бандлы)
#    - index.html

# 3. Загрузить содержимое dist/ на хостинг Beget:
#    - assets/ → public_html/assets/
#    - index.html → public_html/index.html
```

**Важно:** Код фронтенда **никогда не редактируется на сервере**. Все изменения вносятся локально и деплоятся через сборку.

### Структура сервера (public_html)

```
public_html/
├── api/                 # PHP бэкенд
│   ├── .htaccess        # URL rewriting
│   ├── auth.php
│   ├── launches.php
│   └── ...
├── assets/              # Скомпилированный фронтенд
│   ├── chunk-*.js
│   └── style-*.css
├── .env                 # Переменные окружения
└── index.html           # Точка входа SPA
```

---

## 🔧 Переменные окружения

### .env файл (корень проекта)

```env
# === База данных PostgreSQL ===
DB_HOST=lukromoufa.beget.app
DB_PORT=5432
DB_NAME=flinferd_prod
DB_USER=flinferd_app
DB_PASS=<пароль>
DB_SSLMODE=require

# === JWT токены ===
JWT_SECRET=<секретный ключ 32+ символа>
ACCESS_TTL=900          # 15 минут
REFRESH_TTL=2592000     # 30 дней

# === YandexGPT ===
YANDEX_GPT_API_KEY=<AQV...>
YC_FOLDER_ID=b1gxxxxxx
YC_MODEL=yandexgpt/latest

# === CORS (опционально) ===
ALLOWED_ORIGINS=https://producer-ai.ru,http://localhost:3000
```

### Чтение переменных в PHP

```php
// Через helper функцию env()
$apiKey = env('YANDEX_GPT_API_KEY');
$folder = env('YC_FOLDER_ID');

// Fallback-парсер без composer (на shared hosting)
if (!isset($_ENV['DB_HOST'])) {
    // Парсинг .env вручную
}
```

---

## 📜 История проекта

### Версия 2.0 (Текущая)

**Дата:** 2025
**Ключевые изменения:**
- Переход на JWT-аутентификацию с refresh-токенами
- Разделение доступа по ролям (user/owner)
- Интеграция YandexGPT для генерации брифов и анализа ниши
- Рефакторинг БД: нормализация таблиц, JSONB для гибких данных
- Миграция на PostgreSQL 16 с SSL-соединением
- Внедрение rate-limiting для защиты от brute-force

### Версия 1.x (Legacy)

**Период:** 2023-2024
**Архитектура:**
- Сессионная аутентификация (PHP sessions)
- Монолитный фронтенд без сборки
- Прямые SQL-запросы без ORM
- Локальное хранение данных в SQLite

**Причины миграции:**
- Необходимость масштабирования
- Требования безопасности (JWT, httpOnly cookies)
- Интеграция AI-возможностей
- Разделение frontend/backend для независимой разработки

### Эволюция стека

| Компонент | Было (v1) | Стало (v2) |
|-----------|-----------|------------|
| Auth | Sessions | JWT + httpOnly refresh |
| Frontend | Vanilla JS | React 18 + TypeScript |
| Build | None | Vite 6 |
| Styles | Custom CSS | Tailwind CSS v4 |
| DB | SQLite | PostgreSQL 16 (SSL) |
| AI | Отсутствует | YandexGPT-5 |
| Hosting | Shared | VDS + managed PostgreSQL |

---

## 🚀 Быстрый старт

### Для разработчика

```bash
# Клонировать репозиторий
git clone <repo-url>
cd workspace

# Установить зависимости
npm install

# Запустить локально
npm run dev

# Открыть браузер
http://localhost:3000
```

### Для развёртывания на Beget

```bash
# 1. Применить миграции БД
psql "postgres://user:pass@host/db?sslmode=require" -f sql/migrations_v2.sql

# 2. Создать владельца
php scripts/create_owner.php '<secure_password>'
rm scripts/create_owner.php  # Удалить после выполнения!

# 3. Настроить .env
cp .env.example .env
# Отредактировать значения

# 4. Собрать фронтенд
npm run build

# 5. Загрузить на сервер
#    - dist/* → public_html/
#    - api/ → public_html/api/
#    - .env → корень public_html/
```

---

## 📞 Контакты и поддержка

- **Документация:** Этот README.md
- **Исходный код:** `/workspace`
- **API Base:** `https://producer-ai.ru/api`
- **Yandex Cloud Console:** `https://console.cloud.yandex.ru`

---

*Документация сгенерирована для версии 2.0. Актуальную информацию см. в исходном коде.*