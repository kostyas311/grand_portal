# Руководство по развёртыванию — Нормбаза

## Требования к серверу

| Компонент | Минимум | Рекомендуется |
|-----------|---------|--------------|
| ОС | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| RAM | 4 GB | 8 GB |
| CPU | 2 cores | 4 cores |
| Диск (ОС) | 30 GB SSD | 50 GB SSD |
| Диск (файлы) | 100 GB | 500 GB+ |
| Docker | 24+ | 24+ |
| Docker Compose | 2.20+ | 2.20+ |

## Первое развёртывание

### 1. Разместить проект на сервере

```bash
cd /opt
git clone <repo_url> normbase
cd normbase
```

### 2. Создать `.env`

```bash
cp .env.example .env
nano .env
```

Обязательно задать:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `POSTGRES_PASSWORD`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Генерация секретов:

```bash
openssl rand -hex 32
```

### 3. Подготовить файловое хранилище

```bash
mkdir -p ./storage
chmod 755 ./storage
```

### 4. Запустить сервисы

```bash
docker compose up -d --build
```

## Что происходит при запуске

- `postgres` поднимает основную БД;
- `api` собирается из монорепо и на старте выполняет:
  - `prisma db push --accept-data-loss`
  - `node dist/prisma/seed.js`
  - `node dist/main`
- `web` запускается как production-сборка Next.js;
- `nginx` публикует портал на `80` порту.

Отдельно запускать `prisma migrate deploy` и `npm run seed` после обычного старта не требуется: это уже заложено в команду контейнера API.

## Базовая проверка после запуска

```bash
docker compose ps
docker compose logs --tail=80 api
docker compose logs --tail=40 web
docker compose logs --tail=40 nginx
```

Откройте в браузере:

- `http://<IP-адрес-сервера>`

Проверьте:

1. вход под администратором;
2. список пользователей;
3. справочник источников;
4. карточки;
5. инструкции;
6. обращения к администратору;
7. настройки email-уведомлений.

## Обновление

```bash
cd /opt/normbase
git pull
docker compose up -d --build
```

Если нужно пересобрать только отдельный сервис:

```bash
docker compose up -d --build api
docker compose up -d --build web
```

## Резервное копирование

### База данных

```bash
#!/bin/bash
BACKUP_DIR="/opt/backup/db"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

docker exec normbase_postgres pg_dump \
  -U "${POSTGRES_USER:-normbase}" "${POSTGRES_DB:-normbase}" \
  > "$BACKUP_DIR/normbase_$DATE.sql"

find "$BACKUP_DIR" -name "*.sql" -mtime +30 -delete
```

### Файловое хранилище

```bash
#!/bin/bash
rsync -av --delete /opt/normbase/storage/ /opt/backup/storage/
```

## Восстановление БД

```bash
docker compose stop api
docker exec -i normbase_postgres psql \
  -U "${POSTGRES_USER:-normbase}" "${POSTGRES_DB:-normbase}" \
  < /opt/backup/db/normbase_20260402_020000.sql
docker compose start api
```

## Конфигурация домена

Если портал должен открываться по DNS-имени:

1. отредактировать `nginx/nginx.conf`;
2. заменить `server_name _;` на нужный хост;
3. настроить DNS A-запись на IP сервера.

## Мониторинг и эксплуатация

```bash
docker stats
df -h /opt/normbase/storage
docker compose logs -f --tail=100
```

Что полезно мониторить:

- доступность `nginx`, `web`, `api`, `postgres`;
- свободное место в `storage`;
- рост объёма PostgreSQL;
- ошибки SMTP;
- загрузку API при массовой работе с файлами.

## Практические замечания

- `storage` должен быть отдельной сохраняемой директорией;
- seed запускается при каждом старте API, поэтому следует держать его идемпотентным;
- для production желательно вынести резервное копирование и мониторинг за пределы compose-стека;
- для боевого контура стоит подготовить отдельный reverse proxy с TLS и внешним мониторингом.
