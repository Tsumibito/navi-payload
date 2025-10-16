# Установка PostgreSQL на сервере и восстановление данных

## 1. Установка PostgreSQL на Ubuntu/Debian сервере

```bash
# Обновление пакетов
sudo apt update

# Установка PostgreSQL 16 (рекомендуемая версия)
sudo apt install -y postgresql-16 postgresql-contrib-16

# Автозапуск при старте системы
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

## 2. Настройка PostgreSQL

```bash
# Переключиться на пользователя postgres
sudo -u postgres psql

# В psql выполнить:
CREATE USER payload WITH PASSWORD 'ВАШ_СИЛЬНЫЙ_ПАРОЛЬ';
CREATE DATABASE payload OWNER payload;
GRANT ALL PRIVILEGES ON DATABASE payload TO payload;

# Выход из psql
\q
```

## 3. Настройка удалённого доступа (если нужно)

```bash
# Редактировать конфигурацию PostgreSQL
sudo nano /etc/postgresql/16/main/postgresql.conf

# Найти и изменить:
listen_addresses = '*'  # или конкретный IP

# Настройка аутентификации
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Добавить строку (замените IP на ваш):
host    payload         payload         ВАШ_IP/32         md5

# Перезапустить PostgreSQL
sudo systemctl restart postgresql
```

## 4. Восстановление данных из бэкапа

У вас есть два файла бэкапа:
- `payload_backup_20251009_182036.dump` (3.9MB, бинарный формат)
- `payload_backup_20251009_182044.sql` (22MB, текстовый формат)

### Вариант A: Восстановление из .dump файла (рекомендуется)

```bash
# Скопировать файл на сервер
scp backups/payload_backup_20251009_182036.dump user@server:/tmp/

# На сервере:
pg_restore -U payload -d payload -v /tmp/payload_backup_20251009_182036.dump
```

### Вариант B: Восстановление из .sql файла

```bash
# Скопировать файл на сервер
scp backups/payload_backup_20251009_182044.sql user@server:/tmp/

# На сервере:
psql -U payload -d payload < /tmp/payload_backup_20251009_182044.sql
```

## 5. Проверка данных после восстановления

```bash
psql -U payload -d payload -c "SELECT COUNT(*) FROM posts;"
psql -U payload -d payload -c "SELECT COUNT(*) FROM certificates;"
psql -U payload -d payload -c "SELECT COUNT(*) FROM tags;"
```

Должно быть:
- posts: 44
- certificates: 7
- tags: 55

## 6. Настройка .env на сервере

```bash
DATABASE_URI=postgres://payload:ВАШ_ПАРОЛЬ@localhost:5432/payload
```

## 7. Для Docker на сервере (альтернатива)

```bash
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: payload
      POSTGRES_PASSWORD: ВАШ_ПАРОЛЬ
      POSTGRES_DB: payload
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

volumes:
  postgres_data:
```

Затем восстановить данные в контейнер:
```bash
docker cp payload_backup_20251009_182036.dump container_name:/tmp/
docker exec container_name pg_restore -U payload -d payload -v /tmp/payload_backup_20251009_182036.dump
```

## Полезные команды

```bash
# Проверка статуса PostgreSQL
sudo systemctl status postgresql

# Логи PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Список баз данных
psql -U postgres -c "\l"

# Размер базы данных
psql -U payload -d payload -c "SELECT pg_size_pretty(pg_database_size('payload'));"
```
