# Соц-вход + юридические страницы — инструкция

Что уже в коде:

- **Вход через Google / VK ID / Yandex** — OAuth 2.0 + PKCE + `state` (защита от CSRF).
  Храним только связку `provider + providerAccountId` (таблица `OAuthAccount`).
  **Токены доступа не сохраняем**, в соцсети от имени пользователя ничего не делаем.
- Кнопка провайдера показывается, только когда заданы его `CLIENT_ID` и `CLIENT_SECRET`.
- Страницы: `/legal/privacy`, `/legal/terms`, `/legal/cookies`.
- Баннер согласия на cookie (`rp_consent`) + футер со ссылками на документы.

---

## 1. Один раз: создать таблицу в БД

Добавлена модель `OAuthAccount`. Накатить на боевую базу (Neon):

```bash
# DATABASE_URL/DIRECT_URL должны указывать на прод-базу
npx prisma db push
```

(Локально для dev-копии на SQLite — то же самое: `npx prisma db push`.)

## 2. Завести приложения у провайдеров и вписать ключи

Redirect URI везде одинакового вида:
`{OAUTH_REDIRECT_BASE}/api/auth/oauth/{provider}/callback`

Например для Google:
`https://clippers-hub.vercel.app/api/auth/oauth/google/callback`

### Google
1. https://console.cloud.google.com → APIs & Services → Credentials.
2. Create credentials → OAuth client ID → Web application.
3. Authorized redirect URI: `.../api/auth/oauth/google/callback`.
4. Скопировать Client ID/Secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
5. На экране OAuth consent укажи ссылки на `/legal/privacy` и `/legal/terms`.

### Yandex
1. https://oauth.yandex.ru → Создать приложение → Веб-сервисы.
2. Redirect URI: `.../api/auth/oauth/yandex/callback`.
3. Доступы: «Доступ к адресу почты» + «Доступ к логину, имени, аватару».
4. Client ID/Secret → `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`.

### VK ID
1. https://id.vk.com / https://dev.vk.com → создать приложение (VK ID).
2. Доверенный redirect URL: `.../api/auth/oauth/vk/callback`.
3. Scope: email.
4. ID/Secret → `VK_CLIENT_ID`, `VK_CLIENT_SECRET`.
   > VK ID (OAuth 2.1) самый капризный — проверь поток с реальными ключами; при необходимости подправим `lib/oauth.ts` (эндпоинты `id.vk.com/oauth2/auth` и `/oauth2/user_info`).

## 3. Прописать env на Vercel

`OAUTH_REDIRECT_BASE` = публичный адрес сайта (точно как в консолях).
Плюс пары `*_CLIENT_ID` / `*_CLIENT_SECRET` тех провайдеров, что включаешь.
После добавления — Redeploy.

---

## 4. Перед публичным запуском (юридическое)

- Замени контакты/реквизиты в `lib/legal.ts` (email, бренд, домен).
- Документы — **шаблоны**, не юр-консультация. Покажи юристу.
- Для РФ-аудитории 152-ФЗ требует неинженерных шагов: уведомление в Роскомнадзор,
  локализация ПДн граждан РФ на серверах в РФ (сейчас БД вне РФ — это надо решить),
  согласие на обработку ПДн. Для GDPR — свои требования.
- Мы намеренно собираем минимум: email, имя, аватар, ник. Карты/токены/контент соцсетей не храним.
