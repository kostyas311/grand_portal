# Codex Handoff

## Что Это За Проект

- Название: `Нормбаза`
- Назначение: внутренний портал для управления сметно-нормативной документацией и связанным документооборотом
- Формат: monorepo
- Backend: NestJS + Prisma + PostgreSQL
- Frontend: Next.js App Router
- Контейнеризация: `docker compose`

## Где Основное

- Backend:
  - [app.module.ts](C:\Users\S\Documents\AI\normbase_portal\apps\api\src\app.module.ts)
  - [schema.prisma](C:\Users\S\Documents\AI\normbase_portal\apps\api\prisma\schema.prisma)
  - [cards.service.ts](C:\Users\S\Documents\AI\normbase_portal\apps\api\src\modules\cards\cards.service.ts)
  - [notifications.service.ts](C:\Users\S\Documents\AI\normbase_portal\apps\api\src\modules\notifications\notifications.service.ts)
- Frontend:
  - [dashboard/page.tsx](C:\Users\S\Documents\AI\normbase_portal\apps\web\src\app\dashboard\page.tsx)
  - [cards/page.tsx](C:\Users\S\Documents\AI\normbase_portal\apps\web\src\app\cards\page.tsx)
  - [cards/[id]/page.tsx](C:\Users\S\Documents\AI\normbase_portal\apps\web\src\app\cards\[id]\page.tsx)
  - [Sidebar.tsx](C:\Users\S\Documents\AI\normbase_portal\apps\web\src\components\layout\Sidebar.tsx)
  - [globals.css](C:\Users\S\Documents\AI\normbase_portal\apps\web\src\app\globals.css)

## Что Уже Реализовано

- Карточки с жизненным циклом:
  - `NEW`
  - `IN_PROGRESS`
  - `REVIEW`
  - `DONE`
  - `CANCELLED`
- Роли:
  - `USER`
  - `MANAGER`
  - `ADMIN`
- Канбан-доска и список карточек
- Центр уведомлений
- Обращения к администратору
- Подписка на карточки
- Информационные карточки:
  - `withoutSourceMaterials`
  - `withoutResult`
- Версионирование результатов
- История действий и комментарии
- Отчёты
- Отдельная бизнес-презентация продукта:
  - [executive-presentation.html](C:\Users\S\Documents\AI\normbase_portal\docs\product\executive-presentation.html)

## Важные Бизнес-Правила

- Создатель карточки автоматически подписывается на неё как watcher с `AUTO`
- В режиме `Назначено на меня` карточки должны показываться только если:
  - пользователь исполнитель
  - или пользователь проверяющий и карточка в `REVIEW`
  - или пользователь подписался вручную (`MANUAL`)
- Для информационной карточки:
  - блок исходных материалов скрывается, если карточка помечена как без ИД
  - результат можно загружать всегда, даже если он необязателен
- Отмена карточки доступна любой роли

## Уведомления

### Внутренние уведомления

- Хранятся в:
  - `notifications`
  - `pending_notifications`
- Логика батчинга:
  - уведомления накапливаются
  - flush раз в 3 минуты
- Основной файл:
  - [notifications.service.ts](C:\Users\S\Documents\AI\normbase_portal\apps\api\src\modules\notifications\notifications.service.ts)

### Email-уведомления

- Добавлен singleton-конфиг SMTP:
  - модель `NotificationEmailSettings` в [schema.prisma](C:\Users\S\Documents\AI\normbase_portal\apps\api\prisma\schema.prisma)
- Admin-only API:
  - `GET /api/notification-email-settings`
  - `PATCH /api/notification-email-settings`
  - `POST /api/notification-email-settings/test`
- Backend:
  - [notification-email-settings.service.ts](C:\Users\S\Documents\AI\normbase_portal\apps\api\src\modules\notification-email-settings\notification-email-settings.service.ts)
  - [notification-email-settings.controller.ts](C:\Users\S\Documents\AI\normbase_portal\apps\api\src\modules\notification-email-settings\notification-email-settings.controller.ts)
- Frontend-страница админа:
  - [page.tsx](C:\Users\S\Documents\AI\normbase_portal\apps\web\src\app\admin\notifications\page.tsx)

### Текущая Логика Email-Адресатов

- Для карточек email отправляется только если пользователь:
  - подписан на карточку
  - или является создателем карточки
  - или является проверяющим для события `REVIEW_REQUEST`
- Для обращений к администратору письма идут только тем, кому само уведомление назначено
- Письма:
  - HTML
  - содержат только новые изменения за текущий интервал
  - содержат прямую ссылку на карточку или `/requests`

### Важный Технический Нюанс

- Для `nodemailer` в Nest/CommonJS нужно использовать:
  - `import * as nodemailer from 'nodemailer'`
- Это уже исправлено в:
  - [notification-email-settings.service.ts](C:\Users\S\Documents\AI\normbase_portal\apps\api\src\modules\notification-email-settings\notification-email-settings.service.ts)
  - [notifications.service.ts](C:\Users\S\Documents\AI\normbase_portal\apps\api\src\modules\notifications\notifications.service.ts)

## Админский Раздел

- Пользователи:
  - [admin/users/page.tsx](C:\Users\S\Documents\AI\normbase_portal\apps\web\src\app\admin\users\page.tsx)
- Email-уведомления:
  - [admin/notifications/page.tsx](C:\Users\S\Documents\AI\normbase_portal\apps\web\src\app\admin\notifications\page.tsx)
- Пункт меню уже добавлен в:
  - [Sidebar.tsx](C:\Users\S\Documents\AI\normbase_portal\apps\web\src\components\layout\Sidebar.tsx)

## Docker И Запуск

- Основная команда пересборки:
  - `docker compose up -d --build api web`
- Проверка состояния:
  - `docker compose ps`
- Логи:
  - `docker compose logs --tail=80 api`
  - `docker compose logs --tail=40 web`
  - `docker compose logs --tail=40 nginx`

## Текущее Состояние После Последних Изменений

- `api` собирается и стартует
- `web` собирается и стартует
- `nginx` работает
- Маршрут `/admin/notifications` существует
- Маршрут `POST /api/notification-email-settings/test` существует
- Ошибка `500` на тесте соединения из-за `nodemailer.createTransport` уже исправлена

## Что Лучше Проверять Первым Делом В Новой Сессии

1. Открыть `/admin/notifications`
2. Проверить `Тест соединения` на реальном SMTP
3. Проверить сохранение SMTP-настроек
4. Проверить реальную email-доставку:
   - изменение статуса карточки
   - комментарий
   - отправка на проверку
5. Убедиться, что письма не уходят лишним адресатам

## Что Можно Улучшить Дальше

- Добавить кнопку `Отправить тестовое письмо`
- Сделать блокировку `Сохранить`, пока тест не пройден на текущем наборе полей
- Вынести HTML-шаблон email в отдельный template helper
- Добавить более дружелюбные тексты SMTP-ошибок
- Добавить `PORTAL_BASE_URL` в `.env.example` явно, если письма будут использоваться не только на `localhost`

## Полезные Артефакты Внутри Проекта

- Презентация для руководства:
  - [executive-presentation.html](C:\Users\S\Documents\AI\normbase_portal\docs\product\executive-presentation.html)
- Снятые реальные материалы для презентации:
  - [login.png](C:\Users\S\Documents\AI\normbase_portal\docs\product\screens\login.png)
  - [login-inprivate.png](C:\Users\S\Documents\AI\normbase_portal\docs\product\screens\login-inprivate.png)

## Что Не Стоит Сохранять В ХэндОффе

- Реальные SMTP-пароли
- Приватные логины
- Временные профили браузера в `docs/product/edge-profile*`

