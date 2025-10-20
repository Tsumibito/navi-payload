#!/bin/bash

# Скрипт для применения SQL миграций к базе данных Payload
# Использование: ./scripts/apply-migration.sh migrations/add_media_image_sizes.sql

set -e

if [ -z "$1" ]; then
  echo "❌ Ошибка: укажите путь к файлу миграции"
  echo "Использование: ./scripts/apply-migration.sh migrations/filename.sql"
  exit 1
fi

MIGRATION_FILE="$1"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Ошибка: файл $MIGRATION_FILE не найден"
  exit 1
fi

echo "🚀 Применение миграции: $MIGRATION_FILE"
echo ""

# Загружаем DATABASE_URI из .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$DATABASE_URI" ]; then
  echo "❌ Ошибка: DATABASE_URI не найден в .env"
  exit 1
fi

# Извлекаем параметры подключения
DB_HOST=$(echo $DATABASE_URI | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URI | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URI | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URI | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URI | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

echo "📊 Подключение к базе данных:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Применяем миграцию через psql с установкой search_path
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
SET search_path TO navi;
\i $MIGRATION_FILE
EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Миграция успешно применена!"
else
  echo ""
  echo "❌ Ошибка при применении миграции"
  exit 1
fi
