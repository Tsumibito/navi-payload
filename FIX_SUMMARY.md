# 🔧 Исправления от 2025-10-16

## ✅ Что исправлено:

### 1. База данных - колонки для image sizes
- ✅ Создана миграция `migrations/add_media_image_sizes.sql`
- ✅ Миграция успешно применена к БД
- ✅ Добавлены колонки для всех 5 размеров (thumbnail, post, card, og, featured)

### 2. Скрипт регенерации изображений
- ✅ Исправлена команда в `package.json` → указывает на правильный скрипт для R2
- ✅ Создан скрипт `scripts/regenerate-r2-image-sizes.ts` для работы с Cloudflare R2

### 3. Безопасность
- ✅ Удалён хардкоженный пароль из `scripts/run-migration.js`
- ✅ Создана инструкция `SECURITY_FIX.md` по очистке Git истории

## 🚀 Следующие шаги:

### Шаг 1: Остановите dev сервер (если запущен)
```bash
# Нажмите Ctrl+C в терминале где запущен npm run dev
```

### Шаг 2: Перезапустите сервер
```bash
cd /Users/al1/Navi/CascadeProjects/windsurf-project/navi-payload
npm run dev
```

### Шаг 3: Проверьте что ошибки исчезли
Откройте любой пост в админке - ошибки `column "sizes_thumbnail_url" does not exist` должны исчезнуть.

### Шаг 4: Запустите регенерацию изображений
**ТОЛЬКО после того как убедитесь что ошибок нет:**

```bash
npm run regenerate:images
```

Это займёт время - скрипт будет:
- Скачивать каждое изображение из R2
- Генерировать 5 размеров
- Загружать их обратно в R2
- Обновлять метаданные в БД

### Шаг 5: СРОЧНО - исправьте утечку пароля
**Следуйте инструкциям в файле `SECURITY_FIX.md`:**

1. **Немедленно смените пароль БД** у провайдера
2. Очистите Git историю от старого пароля
3. Force push на GitHub

## 🎯 Проверка результата

После регенерации изображений проверьте:

```bash
# В БД должны появиться данные о размерах
PGPASSWORD="ВАШ_НОВЫЙ_ПАРОЛЬ" psql -h 91.98.39.139 -p 32769 -U navi_user -d postgres -c "
  SET search_path TO navi;
  SELECT id, filename, 
         sizes_thumbnail_url IS NOT NULL as has_thumbnail,
         sizes_post_url IS NOT NULL as has_post,
         sizes_og_url IS NOT NULL as has_og
  FROM media 
  WHERE mime_type LIKE 'image/%' 
  LIMIT 5;
"
```

## 📝 Дополнительная информация

### Размеры изображений:
- **thumbnail**: 150×150px (cover) - для админки
- **post**: 800px width (inside) - для блога
- **card**: 640px width (inside) - для карточек
- **og**: 1200×630px (cover) - для Open Graph
- **featured**: 1920px width (inside) - для больших экранов

Все в **WebP** формате для оптимизации.

### Если возникнут проблемы:

**Ошибки всё ещё есть после перезапуска:**
```bash
# Полностью пересоздайте БД схему
npm run payload:types
```

**Регенерация не работает:**
- Проверьте что Cloudflare R2 credentials в `.env` правильные
- Проверьте логи - скрипт покажет какие файлы обрабатываются

**Вопросы по безопасности:**
- Читайте `SECURITY_FIX.md`
- Не откладывайте смену пароля БД!
