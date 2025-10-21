# Быстрая настройка деплоя в Coolify

## 1. Создание проекта в Coolify

1. Войдите в Coolify UI
2. Нажмите **"New Resource"** → **"Docker Image"** (или **"Public Repository"**)
3. Выберите:
   - **Repository**: `https://github.com/Tsumibito/navi-payload`
   - **Branch**: `main`
   - **Build Pack**: `Dockerfile`

## 2. Настройка переменных окружения

В разделе **Environment Variables** добавьте:

```env
PAYLOAD_SECRET=<your_payload_secret>
DATABASE_URI=<your_database_uri>
CLOUDFLARE_R2_ACCESS_KEY_ID=<your_cloudflare_access_key_id>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<your_cloudflare_secret_access_key>
CLOUDFLARE_R2_BUCKET_NAME=<your_cloudflare_bucket_name>
CLOUDFLARE_R2_ENDPOINT=<your_cloudflare_endpoint>
CLOUDFLARE_R2_PUBLIC_URL=<your_cloudflare_public_url>
OPENROUTER_TOKEN=<your_openrouter_token>
NODE_ENV=production
```

Опционально:
```env
BASEROW_API_KEY=<your_baserow_api_key>
DATAFORSEO_API_KEY=<your_dataforseo_api_key>
```

## 3. Настройка портов

- **Container Port**: `3000`
- **Public Port**: автоматически (Coolify назначит)

## 4. Настройка домена

В разделе **Domains** добавьте ваш домен, например:
- `payload.navi.training`

Coolify автоматически настроит SSL через Let's Encrypt.

## 5. Deploy

1. Нажмите **"Deploy"**
2. Дождитесь окончания сборки (3-5 минут)
3. Проверьте логи в случае ошибок

## 6. Проверка

После успешного деплоя:
- Откройте `https://ваш-домен/admin`
- Войдите в админ панель
- Проверьте что контент загружается
- Проверьте что изображения отображаются

## Что было настроено

✅ **Dockerfile** - multi-stage build для оптимального размера образа  
✅ **docker-compose.yml** - упрощен (только приложение, PostgreSQL внешний)  
✅ **.dockerignore** - исключает ненужные файлы из образа  
✅ **.env.example** - шаблон переменных окружения  
✅ **next.config.ts** - standalone output + remote patterns для R2  
✅ **DEPLOYMENT.md** - подробная документация  

## Архитектура

```
┌─────────────────┐
│   Coolify       │
│  ┌───────────┐  │
│  │  Payload  │  │──→ PostgreSQL (91.98.39.139:32769)
│  │  + Next.js│  │
│  └───────────┘  │
│       │         │
│       ↓         │
│   Port 3000     │
└─────────────────┘
        │
        ↓
  Cloudflare R2
   (Изображения)
```

## Troubleshooting

### Ошибка подключения к БД
Проверьте что `DATABASE_URI` корректный и PostgreSQL доступен с сервера Coolify.

### Не загружаются изображения
Проверьте настройки Cloudflare R2 и что bucket `navi-keystone` доступен.

### Долгая сборка
Первая сборка занимает 5-7 минут (установка зависимостей). Последующие будут быстрее благодаря кэшированию слоев Docker.
