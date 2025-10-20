#!/bin/bash

# Скрипт для смены пароля пользователя navi_user в PostgreSQL
# ВАЖНО: Выполняйте команды по одной для безопасности

echo "Подключение к PostgreSQL..."

# Подключение к PostgreSQL как суперпользователь
sudo -u postgres psql postgres

# В psql выполните эти команды:
echo "Выполните в psql:"
echo "ALTER USER navi_user WITH PASSWORD '***REMOVED***';"
echo "\q"

# Проверка подключения с новым паролем
echo "Тестирование нового подключения..."
echo "PGPASSWORD='***REMOVED***' psql -h localhost -p 32769 -U navi_user -d postgres -c '\l'"