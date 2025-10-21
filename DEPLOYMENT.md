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
PAYLOAD_SECRET=<your_payload_secret>

# База данных (уже развернута на сервере)
DATABASE_URI=<your_database_uri>

# Cloudflare R2 Storage
CLOUDFLARE_R2_ACCESS_KEY_ID=<your_cloudflare_access_key_id>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<your_cloudflare_secret_access_key>
CLOUDFLARE_R2_BUCKET_NAME=<your_cloudflare_bucket_name>
CLOUDFLARE_R2_ENDPOINT=<your_cloudflare_endpoint>
CLOUDFLARE_R2_PUBLIC_URL=<your_cloudflare_public_url>

# OpenRouter API (для AI функций)
OPENROUTER_TOKEN=<your_openrouter_token>
```

#### Опциональные переменные:

```env
# Baserow API (для миграции данных)
BASEROW_API_KEY=<your_baserow_api_key>

# DataForSEO API (для SEO анализа)
DATAFORSEO_API_KEY=<your_dataforseo_api_key>
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
