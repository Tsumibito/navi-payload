#!/usr/bin/env tsx
/**
 * Миграционный скрипт: Tags → TagsNew
 * 
 * Безопасная миграция из старой схемы (translations array) 
 * в новую схему (нативная локализация Payload)
 * 
 * Использование:
 * - Dry-run (без изменений): pnpm migrate:tags-localized --dry-run
 * - Тестовая миграция 3 записей: pnpm migrate:tags-localized --limit 3
 * - Полная миграция: pnpm migrate:tags-localized
 */

import { getPayload } from 'payload';
import config from '../src/payload.config';

type OldTag = {
  id: string | number;
  name: string;
  slug: string;
  image?: string | { id: string };
  summary?: string;
  content?: any;
  posts?: any[];
  faqs?: any[];
  descriptionForAI?: string;
  socialImages?: {
    thumbnail?: string | { id: string };
    image16x9?: string | { id: string };
    image5x4?: string | { id: string };
  };
  seo?: {
    title?: string;
    meta_description?: string;
    og_image?: string | { id: string };
    focus_keyphrase?: string;
    no_index?: boolean;
    no_follow?: boolean;
  };
  translations?: Array<{
    language: 'ru' | 'ua' | 'en';
    name?: string;
    slug?: string;
    summary?: string;
    content?: any;
    seo?: {
      title?: string;
      meta_description?: string;
      focus_keyphrase?: string;
    };
  }>;
};

const extractMediaId = (field: string | number | { id: string | number } | undefined): number | undefined => {
  if (!field) return undefined;
  if (typeof field === 'string') return parseInt(field, 10);
  if (typeof field === 'number') return field;
  return typeof field.id === 'string' ? parseInt(field.id, 10) : field.id;
};

async function migrateTagsToLocalized() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  console.log('\n🚀 Начало миграции Tags → TagsNew');
  console.log(`   Режим: ${isDryRun ? '🔍 DRY RUN (без изменений)' : '✍️  ЗАПИСЬ В БД'}`);
  if (limit) console.log(`   Лимит: ${limit} записей`);
  console.log('');

  const payload = await getPayload({ config });

  try {
    // 1. Получаем все теги из старой коллекции
    console.log('📖 Чтение старых тегов из коллекции Tags...');
    const { docs: oldTags } = await payload.find({
      collection: 'tags',
      limit: limit || 1000,
      depth: 0, // Не загружаем связанные объекты
    }) as { docs: OldTag[] };

    console.log(`   Найдено: ${oldTags.length} тегов\n`);

    if (oldTags.length === 0) {
      console.log('⚠️  Нет тегов для миграции');
      return;
    }

    const stats = {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    };

    // 2. Мигрируем каждый тег
    for (const oldTag of oldTags) {
      stats.processed++;
      console.log(`\n[${stats.processed}/${oldTags.length}] Обработка: ${oldTag.name} (id: ${oldTag.id})`);

      try {
        // Базовые данные (общие для всех языков)
        const imageId = extractMediaId(oldTag.image);
        const thumbnailId = extractMediaId(oldTag.socialImages?.thumbnail);
        const image16x9Id = extractMediaId(oldTag.socialImages?.image16x9);
        const image5x4Id = extractMediaId(oldTag.socialImages?.image5x4);
        const seoImageId = extractMediaId(oldTag.seo?.og_image);

        // Маппинг языков: из старых translations в нативные локали Payload
        const localeMap: Record<'ru' | 'uk' | 'en', any> = {
          ru: {
            name: oldTag.name,
            slug: oldTag.slug,
            summary: oldTag.summary || '',
            content: oldTag.content,
            descriptionForAI: oldTag.descriptionForAI,
            seo_title: oldTag.seo?.title || '',
            seo_description: oldTag.seo?.meta_description || '',
            focus_keyphrase: oldTag.seo?.focus_keyphrase || '',
            link_keywords: oldTag.seo?.additional_fields?.link_keywords || '',
          },
          uk: { name: '', slug: '', summary: '', content: null, descriptionForAI: '', seo_title: '', seo_description: '', focus_keyphrase: '', link_keywords: '' },
          en: { name: '', slug: '', summary: '', content: null, descriptionForAI: '', seo_title: '', seo_description: '', focus_keyphrase: '', link_keywords: '' },
        };

        // Заполняем переводы из старого translations array
        if (oldTag.translations && Array.isArray(oldTag.translations)) {
          for (const trans of oldTag.translations) {
            const lang = trans.language === 'ua' ? 'uk' : trans.language; // ua → uk
            if (lang in localeMap) {
              localeMap[lang] = {
                name: trans.name || localeMap[lang].name,
                slug: trans.slug || localeMap[lang].slug,
                summary: trans.summary || localeMap[lang].summary,
                content: trans.content || localeMap[lang].content,
                descriptionForAI: localeMap[lang].descriptionForAI, // Используем из RU
                seo_title: trans.seo?.title || localeMap[lang].seo_title,
                seo_description: trans.seo?.meta_description || localeMap[lang].seo_description,
                focus_keyphrase: trans.seo?.focus_keyphrase || localeMap[lang].focus_keyphrase,
                link_keywords: trans.seo?.additional_fields?.link_keywords || localeMap[lang].link_keywords,
              };
            }
          }
        }

        if (isDryRun) {
          console.log('   🔍 DRY RUN: Данные для миграции:');
          console.log(`      - RU: ${localeMap.ru.name} (slug: ${localeMap.ru.slug})`);
          console.log(`      - UK: ${localeMap.uk.name || '(нет перевода)'} (slug: ${localeMap.uk.slug || '(нет)'})`);
          console.log(`      - EN: ${localeMap.en.name || '(нет перевода)'} (slug: ${localeMap.en.slug || '(нет)'})`);
          console.log(`      - Image: ${imageId || 'нет'}`);
          console.log(`      - Posts: ${oldTag.posts?.length || 0}, FAQs: ${oldTag.faqs?.length || 0}`);
          stats.skipped++;
          continue;
        }

        // Создаем запись в TagsNew с дефолтной локалью (ru)
        const newTag = await payload.create({
          collection: 'tags-new',
          data: {
            name: localeMap.ru.name,
            slug: localeMap.ru.slug,
            summary: localeMap.ru.summary,
            content: localeMap.ru.content,
            descriptionForAI: localeMap.ru.descriptionForAI,
            seo: {
              title: localeMap.ru.seo_title,
              meta_description: localeMap.ru.seo_description,
              og_image: seoImageId,
              focus_keyphrase: localeMap.ru.focus_keyphrase,
              link_keywords: localeMap.ru.link_keywords,
              no_index: oldTag.seo?.no_index || false,
              no_follow: oldTag.seo?.no_follow || false,
            },
            image: imageId,
            socialImages: (thumbnailId || image16x9Id || image5x4Id) ? {
              thumbnail: thumbnailId,
              image16x9: image16x9Id,
              image5x4: image5x4Id,
            } : undefined,
            posts: oldTag.posts || [],
            faqs: oldTag.faqs || [],
            _status: 'published',
          },
          locale: 'ru',
        } as any);

        console.log(`   ✅ Создан (RU): ${newTag.id}`);

        // Обновляем локали UK и EN, если есть переводы
        for (const locale of ['uk', 'en'] as const) {
          const localeData = localeMap[locale];
          
          // Пропускаем пустые переводы
          if (!localeData.name && !localeData.slug) {
            console.log(`   ⏭️  Пропущен (${locale.toUpperCase()}): нет перевода`);
            continue;
          }

          await payload.update({
            collection: 'tags-new',
            id: newTag.id,
            data: {
              name: localeData.name,
              slug: localeData.slug,
              summary: localeData.summary,
              content: localeData.content,
              descriptionForAI: localeData.descriptionForAI,
              seo: {
                title: localeData.seo_title,
                meta_description: localeData.seo_description,
                focus_keyphrase: localeData.focus_keyphrase,
                link_keywords: localeData.link_keywords,
              },
            },
            locale,
          } as any);

          console.log(`   ✅ Обновлён (${locale.toUpperCase()})`);
        }

        stats.created++;
      } catch (error) {
        stats.errors++;
        console.error(`   ❌ Ошибка миграции тега ${oldTag.name}:`, error);
      }
    }

    // 3. Итоговая статистика
    console.log('\n' + '='.repeat(60));
    console.log('📊 РЕЗУЛЬТАТЫ МИГРАЦИИ:');
    console.log('='.repeat(60));
    console.log(`Обработано:  ${stats.processed}`);
    console.log(`Создано:     ${stats.created}`);
    console.log(`Пропущено:   ${stats.skipped}`);
    console.log(`Ошибок:      ${stats.errors}`);
    console.log('='.repeat(60) + '\n');

    if (isDryRun) {
      console.log('💡 Запустите без --dry-run для фактической миграции\n');
    } else {
      console.log('✨ Миграция завершена!\n');
      console.log('📝 Следующие шаги:');
      console.log('   1. Проверьте данные в TagsNew через админку');
      console.log('   2. Убедитесь что все переводы корректны');
      console.log('   3. После проверки можно будет переключить фронтенд на TagsNew\n');
    }

  } catch (error) {
    console.error('\n❌ Критическая ошибка миграции:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Запуск
migrateTagsToLocalized();
