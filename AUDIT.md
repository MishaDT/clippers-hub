# ReelPay — аудит и чек-лист фиксов

Источник истины — этот репозиторий (`klipper-netlify`, деплой на Vercel push→GitHub).
Статусы: ☐ todo · ☑ сделано · ⏸ отложено (нужна инфра/реальные интеграции).

## 🔴 Безопасность
- ☑ **[critical]** `lib/auth.ts` — секрет сессии теперь падает с ошибкой в проде, если `SESSION_SECRET` не задан; dev-фолбэк только вне прода.
- ⏸ **[critical]** `actions.ts depositAction` — demo начисляет баланс по кнопке. Осознанный демо-режим; закрыть при подключении реальных платежей.
- ☑ **[high]** `actions.ts withdrawAction` — атомарный `updateMany` с условием `balanceCents >= amount` (нет гонки/двойного вывода).
- ☑ **[high]** `actions.ts submitClipAction` — ветка записи файла в `public/uploads` удалена.
- ☑ **[medium]** `actions.ts joinCampaignAction` — добавлена дедупликация откликов (нет повторной заявки на тот же заказ).
- ☑ **[high]** Базовый in-memory rate-limit на `/api/auth/login|register` (`lib/rate-limit.ts`). Best-effort на serverless; для жёстких гарантий — Upstash/Redis.
- ☑ **[medium]** `depositAction` redirect — теперь только относительные пути (нет open-redirect).

## 🟠 Продукт / потоки
- ☑ **[critical]** После входа/регистрации → `/feed` (`api/auth/*`).
- ☑ **[high]** Залогиненный на `/` → `redirect("/feed")`.
- ☑ **[medium]** `joinCampaignAction` после отклика → `/upload`.
- ☑ **[high]** Регистрация упрощена: имя + email + пароль; ник и роль (BOTH) генерируются авто, роль меняется в профиле.

## 🟡 Информационная архитектура
- ☑ **[high]** Удалены страницы-сироты `/admin /ai-studio /analytics /leaderboard`.
- ☑ **[high]** Удалён дубль входа: мёртвые `loginAction/registerAction` (формы шлют на `/api/auth/*`).
- ☑ **[high]** Удалён `/api/ai/*` (вместе с мёртвым `/ai-studio`).
- ☑ **[medium]** Удалены стабы `/clipper /client`; все редиректы экшенов/входа → `/profile`/`/feed`.
- ☑ **[low]** Убраны мёртвые `revalidatePath("/clipper"/"/client"/"/admin")`.

## 🟢 Тексты
- ☑ **[medium]** Сняты брендовые надстрочники (`upload` → убран, `wallet` → «Кошелёк»).
- ☑ **[medium]** Убраны фейковые числа (рейтинг «4,9» в профиле; блок статов и «+₽2.4М» на лендинге).
- ⏸ **[low]** Лишние `lead`-подзаголовки на дашбордах — точечно позже.

## 🔵 Производительность
- ☑ **[high]** `/campaigns` кэшируется (`unstable_cache`, `revalidate 30`, `publicOnly`) — уже сделано в редизайне.
- ☑ **[high]** `getCurrentUser` обёрнут в React `cache()` (дедуп запроса на рендер).
- ⏸ **[critical]** Neon cold start — платный Neon/keep-warm (инфра).
- ⏸ **[high]** Тяжёлые внешние сэмпл-видео ленты — нужен лёгкий реальный контент.

## 🟣 Код / данные
- ☑ **[medium]** Хелпер `lib/money.expectedPayout()`; применён в `feed`/`upload` (в `campaigns` свой локальный — ок).
- ☑ **[high]** Удалены `@netlify/database` (deps) и `netlify.toml` (мы на Vercel).
- ⏸ **[medium]** Prisma: «JSON-в-строке» + нет миграций (`db push`). Рефактор отдельно.
- ⏸ **[high]** `globals.css` ~4200 строк (слои PASS). Рефактор в токены — отдельная задача.

## ⚪ a11y / надёжность
- ⏸ **[medium]** Контраст `--muted`/`rgba(255,255,255,.55)` местами < 4.5:1 — пройтись точечно.
- ☑ **[medium]** e2e: ссылки на удалённые `/clipper /client` обновлены на `/feed`/`/upload` (полный рерайт под новый UI — позже).
- ☑ **[low]** Добавлена `not-found.tsx`. Route-loading осознанно нет (чтобы меню не пропадало при переходе).
