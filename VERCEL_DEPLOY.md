# Vercel deploy

Рабочая папка для продовой версии: `C:\Users\Misha\Desktop\klipper-netlify`.

Текущий production URL: `https://clippers-hub.vercel.app`

## Что уже готово

- Проект привязан к GitHub: `https://github.com/MishaDT/clippers-hub`.
- Схема Prisma в этой папке уже использует PostgreSQL, а не локальный SQLite.
- Добавлен `vercel.json`.
- Добавлен `.vercelignore`.
- `metadataBase` берется из `NEXT_PUBLIC_SITE_URL` или автоматического `VERCEL_URL`.

## Бесплатный вариант

Vercel Free + текущая Neon PostgreSQL база.

Важно: Neon на бесплатном тарифе может "засыпать". Первый заход после простоя иногда будет медленнее, потом быстро.

## Переменные для Vercel

Нужно добавить в Vercel Project Settings -> Environment Variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `SESSION_SECRET`
- `NEXT_PUBLIC_SITE_URL` (опционально, после выбора финального домена)

Опционально позже:

- `YOUTUBE_DATA_API_KEY`
- `VK_SERVICE_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`

## Команды

```powershell
cd C:\Users\Misha\Desktop\klipper-netlify
npm run typecheck
npm run build
npx vercel login
npx vercel --prod
```
