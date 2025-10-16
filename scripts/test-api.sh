#!/bin/bash

# Скрипт для проверки работы API после восстановления

echo "🔍 Тестирование Payload API"
echo ""

# Определяем URL API
API_URL="http://localhost:3000/api"

# Проверка доступности
if ! curl -s "$API_URL" > /dev/null 2>&1; then
    API_URL="http://localhost:3001/api"
    echo "⚠️  Порт 3000 недоступен, используем 3001"
fi

echo "📡 API URL: $API_URL"
echo ""

# Тест коллекций
echo "📦 Проверка коллекций:"
echo ""

collections=("posts" "tags" "team" "certificates" "media" "redirects")

for collection in "${collections[@]}"; do
    result=$(curl -s "${API_URL}/${collection}?limit=1" | head -c 100)
    
    if echo "$result" | grep -q "\"docs\""; then
        count=$(curl -s "${API_URL}/${collection}?limit=0" | grep -o '"totalDocs":[0-9]*' | cut -d':' -f2)
        echo "✅ ${collection} - ${count} записей"
    elif echo "$result" | grep -q "not allowed"; then
        echo "🔒 ${collection} - требует авторизацию (норма)"
    else
        echo "❌ ${collection} - ошибка: ${result}"
    fi
done

echo ""
echo "🎯 Тест завершён"
echo "📌 Откройте админку: ${API_URL%/api}/admin"
