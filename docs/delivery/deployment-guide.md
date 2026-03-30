# Руководство по развёртыванию — NormBase Portal

## Требования к серверу

| Компонент | Минимум | Рекомендуется |
|-----------|---------|--------------|
| ОС | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| RAM | 4 GB | 8 GB |
| CPU | 2 cores | 4 cores |
| Диск (ОС) | 30 GB SSD | 50 GB SSD |
| Диск (файлы) | 100 GB | 500 GB+ (HDD/NAS) |
| Docker | 24+ | 24+ |
| Docker Compose | 2.20+ | 2.20+ |

## Установка Docker (Ubuntu)

```bash
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
newgrp docker
```

## Первое развёртывание

### 1. Клонировать или скопировать проект на сервер

```bash
cd /opt
git clone <repo_url> normbase
cd normbase
# или скопировать файлы через rsync/scp
```

### 2. Создать файл окружения

```bash
cp .env.example .env
nano .env
```

Обязательно заменить:
- `JWT_SECRET` — случайная строка 64+ символов
- `JWT_REFRESH_SECRET` — другая случайная строка 64+ символов
- `POSTGRES_PASSWORD` — надёжный пароль БД
- `ADMIN_PASSWORD` — пароль первого администратора
- `ADMIN_EMAIL` — email администратора

Генерация секретов:
```bash
openssl rand -hex 32  # запустить дважды для двух секретов
```

### 3. Создать директорию хранилища

```bash
mkdir -p ./storage
chmod 755 ./storage
```

### 4. Запустить сервисы

```bash
docker compose up -d
```

### 5. Применить миграции БД

```bash
docker compose exec api npx prisma migrate deploy
```

### 6. Создать первого пользователя-администратора

```bash
docker compose exec api npm run seed
```

### 7. Проверить работу

```bash
# Статус контейнеров
docker compose ps

# Логи API
docker compose logs -f api

# Логи Frontend
docker compose logs -f web
```

Откройте браузер: `http://<IP-адрес-сервера>`

---

## Обновление

```bash
cd /opt/normbase

# Остановить
docker compose down

# Обновить код
git pull
# или скопировать новые файлы

# Пересобрать образы
docker compose build

# Запустить
docker compose up -d

# Применить новые миграции (если есть)
docker compose exec api npx prisma migrate deploy
```

---

## Резервное копирование

### База данных (ежедневно)

```bash
#!/bin/bash
# /opt/backup/backup-db.sh
BACKUP_DIR="/opt/backup/db"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker exec normbase_postgres pg_dump \
  -U normbase normbase \
  > "$BACKUP_DIR/normbase_$DATE.sql"

# Удалять резервные копии старше 30 дней
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete

echo "Backup completed: normbase_$DATE.sql"
```

Добавить в cron:
```bash
crontab -e
# Каждый день в 2:00
0 2 * * * /opt/backup/backup-db.sh >> /var/log/normbase-backup.log 2>&1
```

### Файловое хранилище (ежедневно)

```bash
#!/bin/bash
# /opt/backup/backup-storage.sh
rsync -av --delete \
  /opt/normbase/storage/ \
  /opt/backup/storage/
```

### Восстановление БД

```bash
# Остановить API
docker compose stop api

# Восстановить БД
docker exec -i normbase_postgres psql \
  -U normbase normbase \
  < /opt/backup/db/normbase_20240101_020000.sql

# Запустить API
docker compose start api
```

---

## Настройка сетевого диска для хранилища (опционально)

Если файлы нужно хранить на сетевом диске (NFS):

```bash
# Установить NFS клиент
sudo apt install nfs-common

# Примонтировать
sudo mount -t nfs <NFS_SERVER>:/share/normbase /opt/normbase/storage

# Добавить в /etc/fstab для автомонтирования
<NFS_SERVER>:/share/normbase /opt/normbase/storage nfs defaults,_netdev 0 0
```

---

## Конфигурация для конкретного IP/домена

Если портал нужно сделать доступным по имени хоста:

1. Отредактировать `nginx/nginx.conf`:
```nginx
server_name portal.company.ru;  # вместо _
```

2. Настроить DNS в локальной сети (указать A-запись на IP сервера)

---

## Мониторинг

```bash
# Использование ресурсов
docker stats

# Место на диске
df -h /opt/normbase/storage

# Размер БД
docker exec normbase_postgres psql -U normbase normbase \
  -c "SELECT pg_size_pretty(pg_database_size('normbase'));"

# Логи в реальном времени
docker compose logs -f --tail=100
```

---

## Настройка администратора

После первого запуска:

1. Откройте `http://<сервер>/login`
2. Войдите с данными из `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)
3. Перейдите в **Пользователи** → создайте остальных пользователей
4. Перейдите в **Справочник источников** → добавьте источники данных
5. Измените пароль администратора в профиле
