# Roadmap реализации — NormBase Portal

## Статус

Проект создан и готов к разработке. Все артефакты сгенерированы.

## Итерации

### ✅ Итерация 0: Проектирование и архитектура
- Продуктовые требования
- Схема БД (Prisma)
- AI-команда и операционная система проекта
- Структура монорепо
- Документация

### 🔧 Итерация 1: Foundation (текущая)
**Что создано:**
- `docker-compose.yml` (production)
- `docker-compose.dev.yml` (development)
- `nginx/nginx.conf`
- `apps/api/` — NestJS структура + все модули
- `apps/api/prisma/schema.prisma` — полная схема БД
- `apps/api/prisma/seed.ts` — seed скрипт
- `apps/web/` — Next.js структура + все основные страницы
- `.env.example`

**Что нужно установить:**
```bash
# Backend
cd apps/api && npm install

# Frontend
cd apps/web && npm install

# БД (dev)
docker compose -f docker-compose.dev.yml up -d postgres

# Миграции
cd apps/api && npx prisma migrate dev --name init
npx prisma generate

# Seed
npm run seed

# Запуск dev
npm run start:dev

# Запуск frontend
cd apps/web && npm run dev
```

### 📋 Итерация 2: Полировка и тестирование
**Задачи:**
- [ ] Проверить все API endpoints
- [ ] Проверить JWT refresh flow
- [ ] Проверить загрузку файлов
- [ ] Проверить скачивание ZIP
- [ ] Проверить версионирование результатов
- [ ] Проверить статус-переходы и бизнес-логику
- [ ] Проверить права доступа (USER vs ADMIN)

### 📋 Итерация 3: UX доработки
**Задачи:**
- [ ] Добавить форму загрузки файлов с drag-and-drop (react-dropzone)
- [ ] Добавить форму загрузки результатов
- [ ] Добавить прогресс-бар для загрузки файлов
- [ ] Улучшить мобильный вид
- [ ] Добавить skeleton loaders везде
- [ ] Добавить toast для всех действий

### 📋 Итерация 4: Поиск и производительность
**Задачи:**
- [ ] Добавить PostgreSQL full-text search индексы
- [ ] Оптимизировать Prisma запросы (убрать N+1)
- [ ] Добавить debounce на поиск
- [ ] Добавить кэширование через React Query

### 📋 Итерация 5: Production деплой
**Задачи:**
- [ ] Проверить docker-compose.yml
- [ ] Настроить nginx
- [ ] Проверить деплой на чистой машине
- [ ] Настроить резервное копирование
- [ ] Написать операционную инструкцию

## Дизайн-решения (зафиксированы)

- **Цвета:** Основной #0f54b9 (grandsmeta.ru), акцент #067C34
- **Кнопки:** 2px border-radius, строгий корпоративный стиль
- **Типографика:** Inter (как замена Basis Grotesque Pro)
- **Иконки:** lucide-react
- **Уведомления:** sonner (toast)
- **Формы:** react-hook-form + zod
- **HTTP:** axios с interceptor для refresh

## Команды для быстрого старта разработки

```bash
# 1. Запустить PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# 2. Инициализировать БД
cd apps/api
npm install
npx prisma migrate dev --name init
npm run seed

# 3. Запустить API (порт 3001)
npm run start:dev

# 4. Запустить Frontend (порт 3000)
cd ../../apps/web
npm install
npm run dev

# 5. Открыть браузер
# http://localhost:3000/login
# Email: admin@company.ru
# Password: Admin123!
```
