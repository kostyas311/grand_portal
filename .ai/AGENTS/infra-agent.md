# Infra Agent — DevOps / Infrastructure Engineer

## Миссия
Обеспечить простое, надёжное развёртывание системы в локальной сети. Docker Compose — основной сценарий.

## Архитектура деплоя

```
Internet (заблокирован)
         ↓
    [Локальная сеть]
         ↓
    [Сервер Linux]
         ↓
┌─────────────────────────────┐
│       Docker Compose        │
│                             │
│  ┌──────────┐ ┌──────────┐  │
│  │  nginx   │ │postgres  │  │
│  │ :80/:443 │ │  :5432   │  │
│  └────┬─────┘ └────┬─────┘  │
│       │            │        │
│  ┌────▼──────────────────┐  │
│  │  api (NestJS) :3001   │  │
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │  web (Next.js) :3000  │  │
│  └──────────────────────┘  │
│                             │
│  volumes:                   │
│  - postgres_data:/var/lib/  │
│  - storage:/app/storage     │
└─────────────────────────────┘
```

## Файлы деплоя

### docker-compose.yml (production)
- postgres: PostgreSQL 15, named volume
- api: NestJS, depends_on postgres
- web: Next.js, depends_on api
- nginx: reverse proxy, порты 80/443

### docker-compose.dev.yml (разработка)
- postgres: с проброской порта 5432
- api: hot reload (nest start --watch)
- web: Next.js dev server (next dev)
- без nginx

## ENV переменные

### API (.env)
```
DATABASE_URL=postgresql://user:pass@postgres:5432/normbase
JWT_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
STORAGE_PATH=/app/storage
MAX_FILE_SIZE=524288000   # 500MB
ZIP_SIZE_LIMIT=524288000  # 500MB — лимит для ZIP on-the-fly
NODE_ENV=production
PORT=3001
```

### Web (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost/api
```

## Nginx конфигурация
- `/` → proxy_pass web:3000
- `/api/` → proxy_pass api:3001
- `client_max_body_size 512M` для загрузки файлов
- gzip включён
- Заголовки безопасности (X-Frame-Options, X-Content-Type-Options)

## Volume стратегия
- `postgres_data` — именованный Docker volume (автоматический бэкап через pg_dump)
- `./storage` — bind mount на хост (легко бэкапить rsync/robocopy)

## Бэкап
```bash
# PostgreSQL dump (ежедневный cron)
docker exec normbase_postgres pg_dump -U normbase normbase > backup_$(date +%Y%m%d).sql

# Файловое хранилище
rsync -av ./storage/ /backup/normbase/storage/
```

## Запуск в локальной сети

### Минимальные требования сервера
- OS: Ubuntu 22.04 LTS или Windows Server 2019+
- RAM: 4GB (8GB рекомендуется)
- CPU: 2 cores
- Disk: 50GB SSD + отдельный диск для storage

### Команды управления
```bash
# Первый запуск
docker compose up -d

# Применить миграции
docker compose exec api npx prisma migrate deploy

# Создать первого admin
docker compose exec api npm run seed:admin

# Остановить
docker compose down

# Обновить (при новой версии)
docker compose pull && docker compose up -d

# Логи
docker compose logs -f api

# Бэкап БД
docker compose exec postgres pg_dump -U normbase normbase > backup.sql
```

## Область ответственности
- docker-compose.yml (production)
- docker-compose.dev.yml (development)
- nginx.conf
- Dockerfile для api
- Dockerfile для web
- .env.example
- Инструкция по деплою
- Инструкция по бэкапу
- Инструкция по обновлению
