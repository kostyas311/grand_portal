# Backend Agent — NestJS Developer

## Миссия
Реализовать надёжный, безопасный и производительный API для NormBase Portal на NestJS.

## Стек
- NestJS 10 + TypeScript
- PostgreSQL 15 + Prisma
- JWT (passport-jwt)
- Multer (file uploads)
- archiver (ZIP generation)
- class-validator + class-transformer (validation)
- bcrypt (password hashing)

## Структура модулей (apps/api/src/)
```
src/
├── main.ts
├── app.module.ts
├── config/                    # ENV config, validation
├── common/
│   ├── decorators/            # @CurrentUser, @Roles, @Public
│   ├── guards/                # JwtAuthGuard, RolesGuard, CardAccessGuard
│   ├── interceptors/          # AuditInterceptor, TransformInterceptor
│   ├── filters/               # AllExceptionsFilter
│   ├── pipes/                 # ValidationPipe
│   └── types/                 # shared types
├── modules/
│   ├── auth/                  # login, refresh, logout
│   ├── users/                 # CRUD пользователей
│   ├── data-sources/          # справочник источников
│   ├── cards/                 # основной модуль карточек
│   │   ├── cards.controller.ts
│   │   ├── cards.service.ts
│   │   ├── cards.repository.ts
│   │   ├── dto/
│   │   └── enums/
│   ├── source-materials/      # исходные материалы
│   ├── results/               # результаты + версионирование
│   ├── history/               # аудит лог
│   ├── comments/              # комментарии проверки
│   ├── files/                 # файловые операции (upload/download/zip)
│   └── search/                # полнотекстовый поиск
└── prisma/                    # PrismaService
```

## API маршруты

### Auth
```
POST /api/auth/login          — вход
POST /api/auth/refresh         — обновить токен
POST /api/auth/logout          — выход
GET  /api/auth/me              — текущий пользователь
```

### Users (ADMIN только)
```
GET    /api/users              — список пользователей
POST   /api/users              — создать пользователя
GET    /api/users/:id          — получить пользователя
PATCH  /api/users/:id          — обновить пользователя
PATCH  /api/users/:id/toggle-active — блокировать/разблокировать
PATCH  /api/users/:id/reset-password — сбросить пароль
DELETE /api/users/:id          — удалить пользователя (ADMIN)
```

### Data Sources
```
GET    /api/data-sources        — список источников
POST   /api/data-sources        — создать (ADMIN)
GET    /api/data-sources/:id    — получить
PATCH  /api/data-sources/:id    — обновить (ADMIN)
PATCH  /api/data-sources/:id/archive — архивировать (ADMIN)
```

### Cards
```
GET    /api/cards               — список карточек (с фильтрами и пагинацией)
POST   /api/cards               — создать карточку
GET    /api/cards/done          — готовые проекты (главная страница портала)
GET    /api/cards/:id           — получить карточку
PATCH  /api/cards/:id           — обновить карточку
PATCH  /api/cards/:id/status    — изменить статус
PATCH  /api/cards/:id/assign    — назначить исполнителя/проверяющего
DELETE /api/cards/:id           — физически удалить (ADMIN)
```

### Source Materials
```
POST   /api/cards/:id/materials              — добавить материал (файл или ссылку)
GET    /api/cards/:id/materials              — список материалов
DELETE /api/cards/:id/materials/:mid        — удалить материал
GET    /api/cards/:id/materials/:mid/download — скачать файл
GET    /api/cards/:id/materials/download-all  — скачать все (ZIP)
```

### Results (версионирование)
```
POST   /api/cards/:id/results                    — создать новую версию результата
GET    /api/cards/:id/results                    — список версий
GET    /api/cards/:id/results/:vid               — получить версию
GET    /api/cards/:id/results/:vid/download-all  — ZIP всех файлов версии
DELETE /api/cards/:id/results/:vid/items/:iid    — удалить элемент (ADMIN)
```

### Comments
```
POST   /api/cards/:id/comments     — добавить комментарий
GET    /api/cards/:id/comments     — список комментариев
DELETE /api/cards/:id/comments/:cid — удалить (ADMIN)
```

### History
```
GET    /api/cards/:id/history      — история действий карточки
```

## Правила безопасности
1. Все маршруты требуют JWT (кроме /login)
2. Файлы всегда отдаются через API (не через статику)
3. Проверка принадлежности файла к карточке при скачивании
4. Валидация mime-type при загрузке
5. Лимит размера файла через ENV MAX_FILE_SIZE (default 500MB)
6. Имена файлов санируются перед сохранением
7. Пути не должны содержать path traversal (../)

## Правила аудит лога
Логировать в card_history при каждом из действий:
- CREATED, STATUS_CHANGED, EXECUTOR_CHANGED, REVIEWER_CHANGED
- SOURCE_MATERIAL_ADDED, SOURCE_MATERIAL_REMOVED
- RESULT_ADDED, RETURNED_WITH_ERRORS, COMPLETED, CANCELLED
- FIELD_UPDATED

## Производительность
- Пагинация на всех list-эндпоинтах (default: 20 items/page, max: 100)
- Полнотекстовый поиск через PostgreSQL tsvector
- Eager loading связанных данных через Prisma include (без N+1)
- Индексы на всех FK и часто фильтруемых полях
