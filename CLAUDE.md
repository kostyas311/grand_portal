# NormBase Portal — Project Master Document

## Что это

Внутренний корпоративный портал для отслеживания входящей документации и процесса её обработки.
Многопользовательская система с авторизацией, карточками задач, файловым хранилищем, версионированием результатов.

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Auth | JWT (access 15min + refresh 7d) + RBAC |
| File Storage | Filesystem (local/network drive) + DB metadata |
| Deployment | Docker Compose |
| Container registry | local |

## Структура монорепо

```
normbase_portal/
├── CLAUDE.md                  # этот файл
├── .ai/                       # AI-команда и операционная система проекта
│   ├── AGENTS/                # конфигурации агентов
│   ├── SKILLS/                # навыки агентов
│   ├── WORKFLOWS/             # рабочие процессы
│   └── COMMANDS/              # команды Product Owner
├── docs/                      # документация
│   ├── product/               # продуктовые артефакты
│   ├── design/                # дизайн-артефакты
│   ├── engineering/           # инженерные артефакты
│   └── delivery/              # артефакты поставки
├── apps/
│   ├── web/                   # Next.js frontend (port 3000)
│   └── api/                   # NestJS backend (port 3001)
├── packages/
│   └── shared/                # общие типы и утилиты
├── storage/                   # файловое хранилище (монтируется в Docker)
├── docker-compose.yml         # production
├── docker-compose.dev.yml     # development
└── .env.example
```

## Роли пользователей

| Роль | Код | Описание |
|------|-----|---------|
| Администратор | ADMIN | Полный доступ, управление справочниками и пользователями |
| Руководитель/Координатор | COORDINATOR | Создание карточек, назначение, смена статусов |
| Исполнитель | EXECUTOR | Работа с назначенными карточками, загрузка результатов |
| Проверяющий | REVIEWER | Проверка результатов, перевод в готово/возврат |

## Статусы карточки

```
NEW → IN_PROGRESS → REVIEW → DONE
                  ↘ IN_PROGRESS (возврат с замечаниями)
NEW → CANCELLED
IN_PROGRESS → CANCELLED
```

## Приоритеты

- `OPTIONAL` — желательно
- `NORMAL` — в рабочем режиме
- `URGENT` — срочно
- `CRITICAL` — очень срочно

## AI-команда

Используй `.ai/` директорию для управления разработкой.
Команды Product Owner: см. `.ai/COMMANDS/`

## Текущий статус

- [x] Проектирование завершено
- [x] AI-команда сформирована (.ai/)
- [x] Документация создана (docs/)
- [x] Backend реализован (NestJS, все модули)
- [x] Frontend реализован (Next.js, все страницы)
- [x] Prisma схема создана
- [x] Docker Compose настроен
- [ ] npm install + prisma migrate (первый запуск)
- [ ] QA проверка
- [ ] Production деплой

## Быстрый старт разработки

```bash
# 1. БД
docker compose -f docker-compose.dev.yml up -d

# 2. API
cd apps/api && npm install
npx prisma migrate dev --name init
npm run seed
npm run start:dev

# 3. Web
cd apps/web && npm install && npm run dev

# 4. Открыть: http://localhost:3000/login
#    Логин: admin@company.ru / Admin123!
```

## Команды Product Owner

Используй `/new-feature`, `/fix-bug`, `/improve-ux`, `/qa-audit` и др.
Полный список: `.ai/COMMANDS/commands.md`
