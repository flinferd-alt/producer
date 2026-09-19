V: 0.2.6 (git, прод) — «product unit»
DOMEN: producer-ai.ru (API_BASE в src/api.ts); в src/data.ts кое-где остался старый flinferd.ru — рассинхрон, чинить отдельно

## DONE — реализовано и работает
... (без изменений до пунктов вебхук/cron)

- вебхук ЮKassa v2: верификация через API (fail-closed 500), идемпотентность, refund по payment_id, canceled не трогает подписку — ЗАДЕПЛОЕН (тест-платёжом проверить при первом реальном платеже)
- миграции: ...
- cron-понижение подписок: scripts/cron_downgrade.php (инвариант me.php, --dry, лог) — ЗАДЕПЛОЕН, работает в Beget cron раз в час# CONTEXT.md — текущее состояние проекта (обновляется агентом после каждой задачи)

V: 0.2.6 (git) — «product unit»
DOMEN: producer-ai.ru (API_BASE в src/api.ts); в src/data.ts кое-где остался старый flinferd.ru — рассинхрон, чинить отдельно

## DONE — реализовано и работает

- auth: JWT access(15м)+refresh(30д, httpOnly cookie), register/login/me/logout, rate-limit 5/15мин, роли user/owner
- бриф распаковки: launches_brief.php + YandexGPT summary, stage → brief_saved
- анализ ниши: Wordstat + конкуренты + сегменты + SWOT, stage → niche_accepted (кнопка «Принять»)
- стратегия продукта: launches_product.php, product_snapshots (модули, тарифы, юнит-экономика, риски), stage → product
- лид-магнит: launches_leadmagnet.php, 3 варианта A/B/C + вердикт ИИ, leadmagnet_snapshots
- трипваер: launches_tripwire.php, оффер+OTO, tripwire_snapshots, stage → funnel (после принятия ЛМ)
- воронка: launches_funnel.php, funnel_snapshots (stages+optimized, traffic, price, ai_verdict, recommendations), stage → traffic; фронт Funnel.tsx на живом API (mode-машина, ИИ-оптимизация по opt-значениям), api.ts generateFunnel/getFunnel, store.tsx FunnelContext; data.ts: мёртвые FUNNEL_STAGES/FUNNEL_OPTIMIZED/FUNNEL_TIPS удалены
- freemium + оплата: payments.php (ЮKassa, тарифы free + pro=4900₽/мес), webhooks/yookassa.php, отмена/возврат. ПРОДУКТОВОЕ РЕШЕНИЕ: тарифная линейка сокращена до Free + Pro — Studio и trial убраны (токены YandexGPT при бесплатном триале выжигались бы; «Студия» не приносила автоматических денег)
- миграции: migrations_v2, v3_search, freemium, yookassa_v2, subscription_v3, launches_user, product, leadmagnet_tripwire
- вебхук ЮKassa v2: верификация через API (fail-closed 500), идемпотентность, refund по payment_id, canceled не трогает подписку — ждёт деплоя
- cron-понижение подписок: scripts/cron_downgrade.php (инвариант me.php, --dry, лог) — ждёт деплоя + Beget cron
- README.md 0.2.6: тарифы, эндпоинты, вебхук, cron, миграции, деплой
- .env.example (13 переменных) + чистка мусора api/ + git rm --cached producer


## STAGES (цепочка)

unpacking → brief_saved → niche_accepted → product → funnel → traffic → sales

## BUGS / НЕ реализовано

1. ✅ РЕШЕНО (ждёт деплоя): cron-понижение подписки — scripts/cron_downgrade.php готов; до постановки в Beget cron остаётся ленивый сброс в me.php для активных пользователей
2. ✅ РЕШЕНО: вебхук ЮKassa v2 — верификация через GET /v3/payments/{id} (refunds: /v3/refunds/{id}), fail-closed 500, идемпотентность (guarded UPDATE), фикс refund (поиск по payment_id из API), canceled больше не сбрасывает активную подписку, сверка суммы API vs БД. Ждёт деплоя
3. ✅ СНИМАЕТСЯ: trial 7 дней отменён продуктовым решением — линейка только Free + Pro. Остатки 'trial' в sql-миграциях — история, код не читает
4. ✅ РЕШЕНО: README переписан под 0.2.6 (14КБ: тарифы, все эндпоинты, вебхук v2, cron, 8 миграций, деплой, roadmap)
5. ✅ РЕШЕНО: битый submodule producer убран из индекса (git rm --cached producer), git status работает
6. ✅ РЕШЕНО: мусор api/ удалён (debug_payments, fix_subscription, migrate_add_user_id, test). ВАЖНО: с СЕРВЕРА public_html/api/ удалить руками тоже — fix_subscription.php выдаёт pro по GET!
7. ✅ РЕШЕНО: .env.example создан (14 переменных: DB, JWT, YandexGPT, Search API, ЮKassa, CORS)
8. Раздел Funnel/Ads/Stats/Agents — демо-данные, реальной AI-генерации воронки нет
9. Автопродление (рекуррент) убрано — ждёт согласования с ЮMoney; payment_method_id в БД уже есть
10. ✅ РЕШЕНО: CORS-баг закрыт — cors() теперь отражает только origins из whitelist ALLOWED_ORIGINS (.env, дефолт producer-ai.ru + localhost:3000), произвольные Origin больше не получают Allow-Credentials. Ждёт деплоя config.php

## NOW (текущая задача)

НЕТ активной задачи. Сделано в сессии: QUEUE #5 Funnel закрыт полностью (миграция launches_funnel.sql → funnel_snapshots; бэкенд launches_funnel.php POST=генерация YandexGPT+нормализация, GET=снапшот; фронт Funnel.tsx на живом API + FunnelContext в store; чистка data.ts; typecheck чист). ЗАДАЧИ ДЕПЛОЯ (на пользователе, без изменений): (1) cron_downgrade.php → сервер → --dry → Beget cron; (2) yookassa.php v2 → public_html/api/webhooks/ (+YOOKASSA_SHOPID/SECRET в .env сервера; тест-платёж → RECV→SUBSCRIPTION_ACTIVATED в логе); (3) УДАЛИТЬ С СЕРВЕРА public_html/api/: debug_payments.php, fix_subscription.php, migrate_add_user_id.php, test.php — fix_subscription выдаёт pro по GET-запросу!; (4) README.md выгрузить/закоммитить; (5) config.php (CORS-whitelist) + payments.php (только pro) → public_html/api/, после деплоя проверить сайт и localhost:3000; (6) сборка фронта → dist → public_html/ с новой офертой; (7) НОВОЕ: launches_funnel.sql накатить в phpPgAdmin, launches_funnel.php → public_html/api/ — без этого генерация воронки на проде не заработает. Следующий шаг: предложение агента ниже.

## QUEUE (порядок подтверждён пользователем)

1. README.md под 0.2.6
2. cron-скрипт понижения подписки + задача в Beget cron
3. верификация вебхука ЮKassa (GET /v3/payments/{id} при каждом уведомлении)
4. trial 7 дней при регистрации
5. ✅ СДЕЛАНО: секция Funnel: таблица + эндпоинт + AI-генерация (миграция, бэкенд, фронт, чистка data.ts)
6. .env.example + чистка мусора api/ + git rm --cached producer
7. (дальше, по приоритету) реклама/креативы, заявка в ЮMoney на рекуррент

## NOTES

- Режим работы закреплён (AGENTS.md п.0): агент = директор+продюсер+разработчик, сам анализирует/предлагает, пользователь подтверждает. Действует с этой сессии.

- Деплой: dist/* → public_html/, api/ → public_html/api/, .env → корень public_html/. Код фронта на сервере не правится.
- src/api.ts и ProductStack.tsx >16K токенов — читать только grep/кусками.
- Тарифы: free (1 запуск), pro 4900₽/мес (подписка 30 дней). Studio/trial убраны по продуктовому решению.