# Codex Handoff

## Что это за проект

- Название: `Нормбаза`
- Назначение: внутренний портал для сопровождения сметно-нормативной документации, карточек задач, инструкций и связанных процессов
- Формат: monorepo
- Backend: NestJS + Prisma + PostgreSQL
- Frontend: Next.js App Router
- Контейнеризация: `docker compose`

## Где основное

- Backend:
  - `apps/api/src/app.module.ts`
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/modules/cards/cards.service.ts`
  - `apps/api/src/modules/notifications/notifications.service.ts`
  - `apps/api/src/modules/instructions/instructions.service.ts`
  - `apps/api/src/modules/admin-requests/admin-requests.service.ts`
- Frontend:
  - `apps/web/src/app/dashboard/page.tsx`
  - `apps/web/src/app/cards/page.tsx`
  - `apps/web/src/app/cards/[id]/page.tsx`
  - `apps/web/src/app/instructions/page.tsx`
  - `apps/web/src/app/requests/page.tsx`
  - `apps/web/src/components/layout/Sidebar.tsx`
  - `apps/web/src/app/globals.css`

## Что уже реализовано

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
- Список карточек и канбан-доска
- Фильтрация и сводные виджеты на главной странице
- Центр уведомлений
- Email-настройки уведомлений
- Обращения к администратору
- База инструкций:
  - папки
  - публикация
  - вложения
  - связи с карточками и источниками
- Протоколы проверки:
  - отдельный раздел
  - шаблоны с пунктами
  - прикрепление к источникам данных
  - копирование в карточку
  - контроль закрытия карточки через чек-лист
- Спринты
- Подписка на карточки
- Информационные карточки:
  - `withoutSourceMaterials`
  - `withoutResult`
- Версионирование результатов
- История действий и комментарии
- Светлая и тёмная тема
- Отчёты

## Важные бизнес-правила

- создатель карточки автоматически подписывается на неё как watcher с `AUTO`;
- карточка может быть информационной и не требовать исходных материалов и/или результата;
- результат можно загружать даже если он необязателен по логике карточки;
- отмена карточки доступна любой роли;
- переход `IN_PROGRESS -> REVIEW` требует назначенного проверяющего и результата;
- возврат из `REVIEW` в `IN_PROGRESS` требует комментарий;
- если у карточки есть протокол проверки, переход `REVIEW -> DONE` требует закрытия всех пунктов, кроме администратора;
- при возврате карточки с незавершённым протоколом комментарий автоматически дополняется непройденными пунктами;
- в статусе `REVIEW` снять протокол, инструкцию или компонент может только проверяющий или администратор;
- закрытые карточки (`DONE`, `CANCELLED`) редактировать нельзя.

## Уведомления

### Внутренние

- Основной файл:
  - `apps/api/src/modules/notifications/notifications.service.ts`
- Есть:
  - список уведомлений;
  - счётчик непрочитанных;
  - уведомления по карточкам;
  - уведомления по обращениям к администратору.

### Email

- Admin-only API:
  - `GET /api/notification-email-settings`
  - `PATCH /api/notification-email-settings`
  - `POST /api/notification-email-settings/test`
- Backend:
  - `apps/api/src/modules/notification-email-settings/notification-email-settings.service.ts`
  - `apps/api/src/modules/notification-email-settings/notification-email-settings.controller.ts`
- Frontend:
  - `apps/web/src/app/admin/notifications/page.tsx`

## Админский раздел

- Пользователи:
  - `apps/web/src/app/admin/users/page.tsx`
- Email-уведомления:
  - `apps/web/src/app/admin/notifications/page.tsx`
- Спринты:
  - `apps/web/src/app/admin/sprints/page.tsx`
- Навигация:
  - `apps/web/src/components/layout/Sidebar.tsx`

## Docker и запуск

- Основная команда пересборки:
  - `docker compose up -d --build`
- API-образ на старте выполняет:
  - `prisma db push`
  - `seed`
  - запуск `node dist/main`
- Проверка состояния:
  - `docker compose ps`
- Логи:
  - `docker compose logs --tail=80 api`
  - `docker compose logs --tail=40 web`
  - `docker compose logs --tail=40 nginx`

## Текущее состояние

- `api` собирается и стартует
- `web` собирается и стартует
- `nginx` работает как reverse proxy
- `postgres` используется как основная БД
- маршруты для карточек, инструкций, обращений, профиля, отчётов и админки присутствуют

## Что лучше проверять первым делом в новой сессии

1. `docker compose ps`
2. `docker compose logs --tail=80 api`
3. вход под администратором
4. список карточек и карточку `/cards/[id]`
5. `/notifications`
6. `/requests`
7. `/instructions`
8. `/review-protocols`
9. `/admin/notifications`

## Что можно улучшать дальше

- вынести более подробный operational runbook по резервному копированию;
- добавить автоматические healthchecks и readiness-маршруты;
- расширить покрытие документации по инструкциям и компонентам карточек;
- описать сценарии нагрузочного тестирования и отказоустойчивости;
- подготовить чек-лист регрессионной проверки перед релизом.

## Полезные артефакты внутри проекта

- Презентация:
  - `docs/product/executive-presentation.html`
- Продуктовые документы:
  - `docs/product/product-brief.md`
  - `docs/product/roles-permissions-matrix.md`
  - `docs/product/status-transitions.md`

## Что не стоит сохранять в handoff

- реальные SMTP-пароли;
- приватные логины;
- локальные `.env`;
- временные browser profile директории внутри `docs/product/edge-profile*`.
