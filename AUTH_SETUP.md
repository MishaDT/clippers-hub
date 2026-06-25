# Соц-вход, cookie и данные

## Что уже сделано

- Таблица `OAuthAccount` добавлена в Prisma.
- Neon уже синхронизирован командой `prisma db push`.
- `OAUTH_REDIRECT_BASE=https://clippers-hub.vercel.app` добавлен в Vercel для Production, Preview и Development.
- Вход через Google / VK ID / Yandex реализован через OAuth + PKCE + `state`.
- Access token и refresh token соцсетей не сохраняются.
- Cookie-баннер показывает, что именно собирается.
- На `/legal/cookies` есть сброс cookie/localStorage/sessionStorage и сброс текущей сессии.
- В профиле есть привязка/отвязка соцсетей и удаление аккаунта.

## Что ещё нужно сделать для реального соц-входа

Сейчас в Vercel нет ключей провайдеров, поэтому кнопки соц-входа остаются неактивными. Нужно создать приложения в кабинетах провайдеров и добавить пары `CLIENT_ID` / `CLIENT_SECRET`.

### Google

Redirect URI:

```text
https://clippers-hub.vercel.app/api/auth/oauth/google/callback
```

Env в Vercel:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

### VK ID

Redirect URI:

```text
https://clippers-hub.vercel.app/api/auth/oauth/vk/callback
```

Env в Vercel:

```text
VK_CLIENT_ID
VK_CLIENT_SECRET
```

VK ID может потребовать дополнительную проверку настроек приложения. Если реальный callback вернёт ошибку, смотреть `lib/oauth.ts`, блок `vkProfile`.

### Yandex

Redirect URI:

```text
https://clippers-hub.vercel.app/api/auth/oauth/yandex/callback
```

Env в Vercel:

```text
YANDEX_CLIENT_ID
YANDEX_CLIENT_SECRET
```

## Как добавить env в Vercel

Через сайт Vercel:

1. Project `clippers-hub`.
2. Settings -> Environment Variables.
3. Добавить нужные ключи для Production, Preview, Development.
4. Сделать Redeploy.

Через CLI:

```bash
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
vercel env add VK_CLIENT_ID production
vercel env add VK_CLIENT_SECRET production
vercel env add YANDEX_CLIENT_ID production
vercel env add YANDEX_CLIENT_SECRET production
vercel deploy --prod
```

## Юридически важно

Документы в `/legal/privacy`, `/legal/terms`, `/legal/cookies` — грамотные шаблоны, но не юридическая консультация.

Перед публичным запуском нужно:

- заменить контакты и реквизиты в `lib/legal.ts`;
- показать документы юристу;
- для РФ-аудитории отдельно решить вопросы 152-ФЗ: уведомление в Роскомнадзор, локализация персональных данных граждан РФ на серверах в РФ, согласия на обработку данных.

Сейчас база Neon находится вне РФ, поэтому для публичного РФ-запуска это нужно отдельно проверить юридически.
