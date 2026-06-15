# Clippers Hub — Deployment Runbook (для людей и AI-агентов)

> Этот файл описывает **как устроен деплой проекта, как его обновлять, что можно и что
> категорически нельзя**. Основано на реальной истории настройки (15 июн 2026).
> Если ты — AI-агент (Claude / Codex), прочитай раздел **«ПРАВИЛА: МОЖНО / НЕЛЬЗЯ»**
> до того, как что-либо менять в инфраструктуре.

---

## 1. Текущее состояние (TL;DR)

- **Сайт живой:** https://clippers-hub-mdt.netlify.app
- **Стек:** Next.js 15 (App Router) + Prisma + PostgreSQL.
- **Хостинг:** Netlify (сайт `clippers-hub-mdt`, команда/account-slug `dudarevmisha`).
- **База:** отдельный **Neon** PostgreSQL, проект `klipper` (AWS eu-west-2, London).
- **Репозиторий:** GitHub `MishaDT/clippers-hub` (приватный).
- **Способ деплоя:** **только локальный Netlify CLI** (см. §4). Авто-деплой по `git push`
  на бесплатном тарифе **не работает** (см. §6).

---

## 2. Две папки проекта (важно понимать!)

| Папка | Назначение | База | Трогать |
|-------|-----------|------|---------|
| `C:\Users\Misha\Desktop\klipper` | **Локальная разработка** | SQLite (`.env` → `file:./dev.db`) | да, тут пишем код |
| `C:\Users\Misha\Desktop\klipper-netlify` | **Деплой-копия** (это и есть git-репозиторий, привязанный к GitHub+Netlify) | PostgreSQL (Neon) | только конфиги деплоя |

**Почему две папки:** Prisma запрещает несоответствие `provider` и реальной БД. Локально
удобно на SQLite, в проде нужен PostgreSQL — одной схемой это не покрыть. Поэтому
`klipper-netlify` — это «причёсанная» копия `klipper` с PostgreSQL-конфигом.

`klipper-netlify` **пересоздаётся** из `klipper` при изменениях кода (см. §8), при этом
сохраняются деплой-специфичные правки (схема на postgres, `binaryTargets`, `netlify.toml`,
`seed-if-empty.js`).

---

## 3. Какие сервисы задействованы

1. **GitHub** — `MishaDT/clippers-hub` (private). Хранит код деплой-копии.
2. **Netlify** — сайт `clippers-hub-mdt`, ID `be95f67a-b8b7-493d-a4f3-292431d1179b`.
   - Build command и плагин заданы в `netlify.toml`.
   - Переменные окружения (Project configuration → Environment variables):
     - `DATABASE_URL` — строка Neon (pooled/любая), **All scopes**, не secret.
     - `DIRECT_URL` — строка Neon (та же или direct), **All scopes**, не secret.
     - `SESSION_SECRET` — случайная строка 32+ символов.
3. **Neon** — проект `klipper`. Здесь живут таблицы и данные. Строка подключения видна
   в Neon Console → проект → Connection string. **Это боевая база сайта.**

> Пароль базы нигде в коде/чате не хранится — только в переменных Netlify и в Neon Console.

---

## 4. Как (пере)деплоить — ЕДИНСТВЕННЫЙ рабочий способ

Из папки деплоя локальным CLI:

```bash
cd C:\Users\Misha\Desktop\klipper-netlify
netlify deploy --build --prod
```

Эта команда: соберёт проект локально, выполнит `prisma db push` (синхронизирует таблицы),
`seed-if-empty.js` (зальёт демо-данные только если база пустая), `next build`, и опубликует
результат в прод. Логи смотреть прямо в выводе.

Перед первым запуском в новой среде убедись, что Netlify CLI установлен и залогинен:
```bash
npm install -g netlify-cli
netlify login           # интерактивно, открывает браузер — делает пользователь
netlify status          # должно показать пользователя и команду
```

---

## 5. Рабочие конфиги (эталон — должны быть именно такими в `klipper-netlify`)

**`prisma/schema.prisma`** (верх файла):
```prisma
generator client {
  provider      = "prisma-client-js"
  // native = ОС сборки; rhel-таргеты = рантайм Netlify Functions (AWS Lambda, Linux)
  binaryTargets = ["native", "rhel-openssl-3.0.x", "rhel-openssl-1.0.x"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**`netlify.toml`:**
```toml
[build]
  command = "npx prisma db push && node prisma/seed-if-empty.js && npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

**`package.json`** (ключевые скрипты):
```json
"postinstall": "prisma generate",
"build": "prisma generate && next build"
```
(`prisma generate` в build обязателен — иначе на чистой сборке падают типы, см. §7.)

**`prisma/seed-if-empty.js`** — запускает `prisma/seed.js` только если `user.count() === 0`
(чтобы повторные деплои не падали на уникальных полях).

**`next.config.ts`** — `images: { unoptimized: true }` (Netlify не требует Image Optimization API).

---

## 6. ПРАВИЛА: МОЖНО / НЕЛЬЗЯ

### ❌ НЕЛЬЗЯ
- **НЕ удалять Neon-проект `klipper`** в Neon Console — это боевая база, сайт сломается.
- **НЕ использовать Netlify DB / `netlify db init` / `@netlify/database`** для данных.
  Проверено — тупик: строка подключения недоступна на сборке и в CLI (`netlify database
  connect` ходит в локальный PGlite-WASM, а не в прод), дашборд её прячет. Для Prisma не годится.
- **НЕ помечать переменные `DATABASE_URL`/`DIRECT_URL` как secret** — на бесплатном тарифе
  «Contains secret values» требует «Specific scopes» (платно) и всё блокирует. Оставлять **All scopes**.
- **НЕ рассчитывать на авто-деплой по `git push`** — на free-плане приватные репозитории
  блокируются: *«Build blocked: Unrecognized Git contributor»*. Деплой только через CLI (§4).
- **НЕ переключать схему деплой-копии обратно на `sqlite`** и **не убирать `binaryTargets`**.
- **НЕ коммитить** `.env`, `*.db`, `node_modules`, `.next`, `.netlify` (уже в `.gitignore`).
- **НЕ использовать `prisma migrate deploy`** — в проекте нет папки `prisma/migrations`.

### ✅ МОЖНО / НУЖНО
- Деплоить командой из §4.
- Менять код в `klipper`, тестировать локально на `http://localhost:3000` (SQLite), затем
  пересобирать `klipper-netlify` (§8) и деплоить.
- Создавать/обновлять таблицы через **`prisma db push`** (не migrate).
- Добавлять новые переменные окружения в Netlify (All scopes).
- Менять данные в Neon Console (SQL-editor) — это боевые данные, аккуратно.

---

## 7. Траблшутинг (симптом → причина → фикс) — то, на что реально напарывались

| Симптом | Причина | Фикс |
|--------|---------|------|
| Сборка падает: `TS7006 Parameter implicitly has an 'any' type` во многих файлах | Prisma Client не сгенерирован/устарел → `prisma.*` стали `any` | `prisma generate` в build-команде (`"build": "prisma generate && next build"`) |
| Статика 200, а динамические страницы (`/`, `/feed`, `/campaigns`) → **500** | Несовпадение движка Prisma: сборка на Windows, а Netlify Functions на Linux | `binaryTargets = ["native","rhel-openssl-3.0.x","rhel-openssl-1.0.x"]`, пересобрать |
| Сборка падает: `Environment variable not found: NETLIFY_DATABASE_URL(_UNPOOLED)` | Netlify DB инжектит свои переменные только в рантайм функций, не в сборку | Не использовать Netlify DB; взять отдельный Neon и задать `DATABASE_URL`/`DIRECT_URL` |
| Деплой по git: `Build blocked: Unrecognized Git contributor` | Free-план не собирает приватные репы от непроверённого автора | Деплоить локальным CLI (§4) |
| Сборка падает на `prisma migrate deploy` | Нет папки `prisma/migrations` | Использовать `prisma db push` |

---

## 8. Как пересобрать `klipper-netlify` из `klipper` (после изменений кода)

1. Скопировать актуальный код из `klipper` в `klipper-netlify`, **исключая**:
   `node_modules`, `.next`, `.git`, `.netlify`, `.env`, `*.db`, `test-results`,
   `playwright-report`, `tsconfig.tsbuildinfo`.
2. Убедиться, что сохранены деплой-правки (§5): postgres-схема + `binaryTargets`,
   `netlify.toml`, `prisma/seed-if-empty.js`, build-скрипт.
3. `git add -A && git commit -m "..."` и (опц.) `git push` в `MishaDT/clippers-hub`.
4. Задеплоить: `netlify deploy --build --prod` (§4).

> Локальную папку `klipper` НЕ переключать на postgres — она остаётся на SQLite для дев-режима.

---

## 9. Что осталось/можно улучшить (необязательно)

- **Включить авто-деплой по push** (любой из вариантов): сделать репозиторий публичным,
  ИЛИ апгрейд тарифа Netlify, ИЛИ подтвердить git-автора как члена команды Netlify.
- Для `DATABASE_URL` использовать **pooled**-строку Neon (с `-pooler`) — лучше для serverless
  под нагрузкой; `DIRECT_URL` оставить прямой для миграций.
- Удалить неиспользуемую **Netlify DB** (Netlify → сайт → Database → Delete database) — пустая.
- Подключить реальные ключи платежей (YooKassa/Stripe) и синхронизации просмотров
  (YouTube/VK) — сейчас работают в демо/мок-режиме.
- Перейти на `prisma migrate` (создать миграции) вместо `db push`, когда схема стабилизируется.

---

## 10. История: откуда начали → к чему пришли

**Старт:** Next.js+Prisma приложение, локально на SQLite; цель — выложить на Netlify.
Куча незакоммиченного кода; в репозитории старый postgres-набросок, но рабочее дерево на SQLite.

**Путь:**
1. Сделали чистую деплой-копию `klipper-netlify` (sibling-папка), переключили на PostgreSQL.
2. Завели GitHub-репозиторий `MishaDT/clippers-hub`, запушили.
3. Создали сайт Netlify `clippers-hub-mdt`, привязали репозиторий.
4. Попробовали встроенную **Netlify DB (Neon)** — **тупик** (см. §6): недоступна Prisma на
   сборке/из CLI, прячет строку подключения, `connect` уводит в локальный PGlite. Убрали Drizzle-скаффолд.
5. Починили падение типов на чистой сборке → `prisma generate` в build.
6. Сделали идемпотентный сидинг (`seed-if-empty.js`).
7. Перешли на **отдельный Neon** (neon.tech), проект `klipper`. Прописали `DATABASE_URL`/
   `DIRECT_URL` в переменных Netlify (не secret — ограничение free-плана).
8. Первый деплой создал таблицы и залил данные, но динамика давала **500** →
   причина: Prisma-движок под Windows на Linux-функциях → добавили `binaryTargets`.
9. Авто-деплой по push оказался заблокирован (free-план) → деплоим **локальным CLI**.
10. **Итог:** сайт полностью рабочий, все страницы 200, данные из Neon рендерятся.

---

*Связанные файлы: `klipper-netlify/DEPLOY.md` (пошаговая инструкция), `DEPLOY_MEMORY.md`
(заметки по рабочему процессу). Старый `DEPLOY.md` про Supabase — устарел, ориентируйся на этот файл.*
