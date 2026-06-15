# Деплой на Netlify — пошагово

Это **готовая к деплою** копия проекта (PostgreSQL вместо SQLite).
Важно: это НЕ статический сайт — его нельзя просто «перетащить» файлами в Netlify.
Netlify должен **собрать** проект и подключить **облачную базу данных**.
Поэтому деплой идёт одним из двух способов (ниже), а перед этим нужна база.

---

## Шаг 1. Создать базу данных (Supabase — бесплатно)

1. Зайти на https://supabase.com → зарегистрироваться → **New project**.
2. Придумать пароль базы (запомнить его).
3. **Settings → Database → Connection string**:
   - **Connection pooling** (URI, порт 6543 или с `pgbouncer=true`) → это `DATABASE_URL`
   - **Direct connection** (порт 5432) → это `DIRECT_URL`
4. В `DATABASE_URL` в конце добавить: `?pgbouncer=true&connection_limit=1`

Альтернатива Supabase — https://neon.tech (тоже бесплатный PostgreSQL).

---

## Шаг 2. Залить схему и тестовые данные в базу

На своём компьютере, из этой папки:

```bash
npm install

# создаём файл .env (по образцу .env.example) и вписываем туда DATABASE_URL / DIRECT_URL / SESSION_SECRET

npx prisma db push      # создаёт все таблицы в облачной базе
npm run db:seed         # заполняет демо-данными (пользователи, кампании, клипы)
```

> Используем `prisma db push`, а НЕ `prisma migrate deploy` — в проекте нет папки
> `prisma/migrations`, поэтому `db push` создаёт таблицы напрямую по `schema.prisma`.

Тестовый вход после seed — смотри логины/пароли в `prisma/seed.js`.

---

## Шаг 3. Выложить на Netlify

### Способ A — через GitHub (рекомендуется, проще и с авто-обновлением)

```bash
git init
git add .
git commit -m "Deploy clippers-hub"
git branch -M main
git remote add origin https://github.com/USERNAME/clippers-hub.git
git push -u origin main
```

Затем на Netlify: **Add new site → Import an existing project → GitHub** →
выбрать репозиторий. Build command и publish уже заданы в `netlify.toml`.

### Способ B — через Netlify CLI (без GitHub, прямо из этой папки)

```bash
npm install -g netlify-cli
netlify login
netlify init        # создать новый сайт
netlify deploy --build --prod
```

---

## Шаг 4. Прописать переменные окружения в Netlify

**Site settings → Environment variables** — добавить:

```
DATABASE_URL = postgresql://...?pgbouncer=true&connection_limit=1
DIRECT_URL   = postgresql://...   (порт 5432, без pgbouncer)
SESSION_SECRET = длинная-случайная-строка-32+символов
NODE_ENV = production
```

После добавления переменных — **Deploys → Trigger deploy → Clear cache and deploy**.

---

## Шаг 5. Проверка

- Открыть URL сайта из Netlify Dashboard.
- Если ошибка 500 → **Logs**: чаще всего не заданы переменные окружения
  или не выполнен `prisma db push` (нет таблиц в базе).

---

## Что уже настроено в этой копии

- `prisma/schema.prisma` → `provider = "postgresql"` (+ `directUrl`)
- `netlify.toml` → сборка через `@netlify/plugin-nextjs`
- `package.json` → `postinstall: prisma generate` (Prisma Client генерится при сборке)
- `next.config.ts` → `images.unoptimized` (Netlify не требует Image Optimization API)
- Платежи работают в **демо-режиме** без ключей; синхронизация просмотров — на мок-данных.
  Реальные ключи (YooKassa/Stripe/YouTube/VK) можно добавить позже в переменные окружения.
