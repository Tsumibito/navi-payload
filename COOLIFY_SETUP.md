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
PAYLOAD_SECRET=***REMOVED***
DATABASE_URI=postgresql://navi_user:***REMOVED***@91.98.39.139:32769/postgres?search_path=navi
CLOUDFLARE_R2_ACCESS_KEY_ID=6f24e5054fac5482f3191cbfa1bd9c01
CLOUDFLARE_R2_SECRET_ACCESS_KEY=***REMOVED***
CLOUDFLARE_R2_BUCKET_NAME=navi-keystone
CLOUDFLARE_R2_ENDPOINT=https://4b346ab1bf81ca8d2b610edfd3c5ddb0.r2.cloudflarestorage.com
CLOUDFLARE_R2_PUBLIC_URL=https://pub-c14094474319495887321b74b5186100.r2.dev
OPENROUTER_TOKEN=***REMOVED***
NODE_ENV=production
```

Опционально:
```env
BASEROW_API_KEY=***REMOVED***
DATAFORSEO_API_KEY=***REMOVED***
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
