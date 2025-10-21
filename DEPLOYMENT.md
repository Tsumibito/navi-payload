# Deployment Guide - Navi Payload CMS

## Архитектура
- **Приложение**: Payload CMS + Next.js (Docker контейнер)
- **База данных**: PostgreSQL (отдельный контейнер на том же сервере)
- **Хранилище**: Cloudflare R2 (S3-compatible)

## Деплой через Coolify

### Шаг 1: Подготовка в Coolify

1. Создайте новый проект типа **"Docker Image"** или **"Dockerfile"**
2. Подключите GitHub репозиторий: `https://github.com/ваш-репозиторий/navi-payload`
3. Укажите branch: `main`
4. Dockerfile: `Dockerfile` (в корне проекта)

### Шаг 2: Настройка переменных окружения

В интерфейсе Coolify добавьте следующие переменные:

#### Обязательные переменные:

```env
# Payload Secret (сгенерируйте: openssl rand -base64 32)
PAYLOAD_SECRET=***REMOVED***

# База данных (уже развернута на сервере)
DATABASE_URI=postgresql://navi_user:***REMOVED***@91.98.39.139:32769/postgres?search_path=navi

# Cloudflare R2 Storage
CLOUDFLARE_R2_ACCESS_KEY_ID=6f24e5054fac5482f3191cbfa1bd9c01
CLOUDFLARE_R2_SECRET_ACCESS_KEY=***REMOVED***
CLOUDFLARE_R2_BUCKET_NAME=navi-keystone
CLOUDFLARE_R2_ENDPOINT=https://4b346ab1bf81ca8d2b610edfd3c5ddb0.r2.cloudflarestorage.com
CLOUDFLARE_R2_PUBLIC_URL=https://pub-c14094474319495887321b74b5186100.r2.dev

# OpenRouter API (для AI функций)
OPENROUTER_TOKEN=***REMOVED***
```

#### Опциональные переменные:

```env
# Baserow API (для миграции данных)
BASEROW_API_KEY=***REMOVED***

# DataForSEO API (для SEO анализа)
DATAFORSEO_API_KEY=***REMOVED***
```

### Шаг 3: Настройка порта

- **Container Port**: 3000
- **Public Port**: 80 или 443 (в зависимости от настроек домена)

### Шаг 4: Домен

Привяжите домен к приложению в настройках Coolify (например: `payload.navi.training`)

### Шаг 5: Deploy

Нажмите **Deploy** - Coolify автоматически:
1. Склонирует репозиторий
2. Соберет Docker образ из Dockerfile
3. Запустит контейнер с указанными переменными окружения
4. Подключится к существующей PostgreSQL базе

## Проверка после деплоя

1. Откройте `https://ваш-домен/admin`
2. Войдите в админ панель
3. Проверьте что изображения загружаются из Cloudflare R2
4. Проверьте AI функции (генерация FAQ, саммари)

## Локальная разработка

Для локальной разработки используйте docker-compose:

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down
```

Или запустите без Docker:

```bash
npm install
npm run dev
```

## Миграции базы данных

Миграции применяются автоматически при запуске приложения благодаря настройке `push: false` в `payload.config.ts`.

Если нужно применить миграции вручную:

```bash
npm run payload:migrate
```

## Troubleshooting

### Проблема: Не подключается к БД
- Проверьте что PostgreSQL контейнер запущен
- Проверьте правильность `DATABASE_URI`
- Убедитесь что приложение может достучаться до `91.98.39.139:32769`

### Проблема: Не загружаются изображения
- Проверьте настройки Cloudflare R2
- Убедитесь что bucket `navi-keystone` существует
- Проверьте что публичный URL доступен

### Проблема: AI функции не работают
- Проверьте `OPENROUTER_TOKEN`
- Проверьте баланс на OpenRouter

## Структура Dockerfile

Используется multi-stage build:
1. **deps** - установка зависимостей
2. **builder** - сборка Next.js приложения
3. **runner** - финальный образ (только runtime файлы)

Размер финального образа: ~200MB
