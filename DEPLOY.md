# DEPLOY.md — план выгрузки накопленных изменений на хостинг (Beget)

Дата: сессия 0.2.6+. Всё, что ниже, — только руками владельца хостинга.

## Что изменилось (кратко)

| Файл | Что поменялось | Зачем |
|---|---|---|
| `api/webhooks/yookassa.php` | **Полностью переписан (v2)** | Безопасность: верификация через API ЮKassa, идемпотентность, фиксы refund/canceled |
| `api/payments.php` | Убран тариф studio | Линейка = Free + Pro |
| `api/config.php` | CORS по whitelist `ALLOWED_ORIGINS` | Чужие сайты больше не могут слать запросы с cookie |
| `scripts/cron_downgrade.php` | **Новый файл** | Автопонижение просроченных подписок в free |
| фронт (`src/`) | Убраны Studio/trial из Welcome, Cabinet, data, api, store | Линейка = Free + Pro |
| `public/legal/offer.html` | Убран пункт «Студия» | Юридика = реальность |
| README, CONTEXT, .env.example | Документация | — |

## Шаг 1. Выгрузить/заменить в public_html/api/ (по SFTP)

```
api/config.php        → public_html/api/config.php        (заменить)
api/payments.php      → public_html/api/payments.php      (заменить)
api/webhooks/yookassa.php → public_html/api/webhooks/yookassa.php  (заменить)
```

## Шаг 2. УДАЛИТЬ с сервера (критично!)

Из `public_html/api/` удалить 4 файла:

```
debug_payments.php       — сливает таблицу платежей в браузер
fix_subscription.php     — ВЫДАЁТ ТАРИФ PRO ПО GET-ЗАПРОСУ ЛЮБОМУ КТО ОТКРОЕТ URL
migrate_add_user_id.php  — разовая миграция, уже применена
test.php                 — тест YandexGPT
```

## Шаг 3. .env (в корне public_html)

Проверить, что есть эти переменные (без них вебхук отвечает 500 fail-closed):

```
YOOKASSA_SHOPID=...
YOOKASSA_SECRET=...
```

Опционально добавить (если нет — сработает дефолт, он правильный):

```
ALLOWED_ORIGINS=https://producer-ai.ru,http://localhost:3000
```

## Шаг 4. Cron-скрипт (НЕ в public_html!)

Выгрузить `scripts/cron_downgrade.php` в папку `scripts/` **рядом** с public_html
(на Beget: `/home/u/ВАШ_ЛОГИН/scripts/`). Скрипт сам найдёт config и .env.

Тест (SSH):
```
php /home/u/ЛОГИН/scripts/cron_downgrade.php --dry
```
Должен написать, сколько подписок просрочено (или «нет»), БД не трогает.

Задача в Beget: панель → Crontab → добавить, раз в час:
```
/usr/local/bin/php /home/u/ЛОГИН/scripts/cron_downgrade.php
```
(путь к php уточнить: `which php`). Лог: `scripts/cron_downgrade.log`.

## Шаг 5. Фронтенд (сборка)

На локальной машине:
```
npm run build
```
Содержимое `dist/` → в `public_html/` (заменить index.html и assets/).
Оферта (`legal/offer.html`) едет в составе dist автоматически.

## Шаг 6. Закрыть логи вебхука от веба (рекомендация)

В `public_html/logs/` создать `.htaccess` с одной строкой:
```
Require all denied
```

## Шаг 7. Проверки после деплоя

1. Открыть сайт → войти → создать/открыть запуск: запросы к /api идут без ошибок (DevTools → Network, нет красных CORS).
2. Чужой origin не пускается:
   `curl -i -H "Origin: https://evil.com" https://producer-ai.ru/api/auth/me`
   → в ответе НЕ должно быть `Access-Control-Allow-Origin`.
3. Тестовый платёж через ЛК ЮKassa → в `public_html/logs/yookassa_webhook.log` строка `RECV` → `VERIFY` → `SUBSCRIPTION_ACTIVATED`, у пользователя стал тариф «Про».
4. Подделка не работает: `curl -X POST https://producer-ai.ru/api/webhooks/yookassa -d '{"event":"payment.succeeded"}'` → 500, в логе UNVERIFIED, подписка НЕ выдаётся.
5. В кабинете тарифы: только Free и Pro, кнопки оплаты ведут на ЮKassa.
6. Через час после cron (или вручную `--dry`): скрипт пишет в cron_downgrade.log.
7. Убедиться, что `https://producer-ai.ru/api/fix_subscription.php` отвечает 404.

## Шаг 8. Git (локально)

Закоммитить и запушить: все изменённые файлы + новые (`scripts/cron_downgrade.php`, `.env.example`, `AGENTS.md`, `CONTEXT.md`, `DEPLOY.md`), удалённые 4 мусорных файла и битый submodule `producer` (уже `git rm --cached`).

---

## ТОЛЬКО владелец может сделать (агенту недоступно)

- доступы Beget (панель/SFTP/SSH) — шаги 1–4, 6
- ЛК ЮKassa: тестовый платёж, проверка URL вебхука (`https://producer-ai.ru/api/webhooks/yookassa`) — шаг 7.3
- Beget Crontab — шаг 4
- `git push` в удалённый репозиторий — шаг 8