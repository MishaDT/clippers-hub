# View Sync Integrations Plan

Цель: платформа не должна верить цифрам, которые клиппер написал руками. Мы храним ссылку на публикацию, определяем платформу, вытаскиваем `postId`, синхронизируем просмотры через провайдера и записываем временной ряд для антифрода.

## Первая очередь

1. YouTube Shorts
   - Переменная: `YOUTUBE_DATA_API_KEY`
   - Метод: `videos.list?part=statistics&id=...`
   - Что берем: `viewCount`, `likeCount`, `commentCount`
   - Статус в коде: каркас готов в `lib/view-providers.ts`

2. VK Video / VK Clips
   - Переменная: `VK_SERVICE_TOKEN`
   - Метод: `video.get`
   - Что берем: `views`, `likes.count`, `comments`
   - Статус в коде: каркас готов в `lib/view-providers.ts`

## Вторая очередь

3. TikTok
   - Нужен OAuth Login Kit и scope `video.list`
   - Прямой sync идет через подключенный аккаунт клиппера
   - Без OAuth можно оставить только ручную проверку/модерацию

4. Instagram Reels
   - Нужен connected creator/professional account
   - Для insights нужен media id, shortcode из URL надо сначала сопоставить с media object
   - Без подключенного аккаунта честный автоматический sync ограничен

## Worker flow

1. Каждые 10-30 минут выбрать submissions со статусом `POSTED`, `VERIFIED`, `THRESHOLD_MET`.
2. Определить платформу по `submission.platform`.
3. Вызвать `viewProviders[platform].fetchSnapshot(submission.postUrl)`.
4. Обновить `currentViews`, `currentLikes`, `currentComments`, `peakViews`.
5. Добавить точку в `viewVelocityJson`.
6. Если `views >= campaign.viewThreshold`, перевести в `THRESHOLD_MET` или `SETTLING`.
7. После settlement period создать earning-транзакцию.

## Источники документации

- YouTube Data API videos: https://developers.google.com/youtube/v3/docs/videos
- TikTok Display API video list: https://developers.tiktok.com/doc/tiktok-api-v2-video-list
- Instagram Media Insights: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/
- VK API requests pattern: https://vk.readthedocs.io/en/2.0/vk-api/
