#!/usr/bin/env tsx
/**
 * Миграционный скрипт: Team → TeamNew
 *
 * Безопасная миграция из старой схемы (translations array)
 * в новую схему (нативная локализация Payload)
 *
 * Использование:
 * - Dry-run (без изменений): pnpm migrate:team-localized --dry-run
 * - Тестовая миграция всех записей: pnpm migrate:team-localized
 */

import { getPayload } from 'payload';
import config from '../src/payload.config';

type OldTeamMember = {
  id: string | number;
  name: string;
  slug: string;
  position: string;
  photo?: string | number | { id: string | number };
  bio?: any; // JSONB - сложная структура Lexical
  bio_summary?: any; // JSONB
  order?: number;
  links?: Array<{
    service: string;
    url: string;
  }>;
  seo?: {
    title?: string;
    meta_description?: string;
    og_image?: string | number | { id: string | number };
    focus_keyphrase?: string;
    additional_fields?: {
      link_keywords?: string;
    };
    no_index?: boolean;
    no_follow?: boolean;
  };
  translations?: Array<{
    _order?: number;
    language: string;
    name?: string;
    position?: string;
    bio?: any;
    bio_summary?: any;
    seo?: {
      title?: string;
      meta_description?: string;
      focus_keyphrase?: string;
      additional_fields?: {
        link_keywords?: string;
      };
    };
  }>;
};

const extractMediaId = (field: string | number | { id: string | number } | undefined): number | undefined => {
  if (!field) return undefined;
  if (typeof field === 'string') return parseInt(field, 10);
  if (typeof field === 'number') return field;
  return typeof field.id === 'string' ? parseInt(field.id, 10) : field.id;
};

// Функция для сохранения Lexical JSON (оставляем как есть)
const preserveLexicalJSON = (lexicalData: any): any => {
  if (!lexicalData) return undefined;
  // Если это уже JSONB объект - возвращаем как есть
  if (typeof lexicalData === 'object') return lexicalData;
  // Если это строка - пытаемся распарсить
  if (typeof lexicalData === 'string') {
    try {
      return JSON.parse(lexicalData);
    } catch {
      // Если не JSON - оборачиваем в простой параграф Lexical
      return {
        root: {
          type: 'root',
          format: '',
          indent: 0,
          version: 1,
          children: [{
            type: 'paragraph',
            format: '',
            indent: 0,
            version: 1,
            children: [{
              type: 'text',
              format: 0,
              text: lexicalData,
              version: 1,
            }],
          }],
        },
      };
    }
  }
  return undefined;
};

async function migrateTeamToLocalized() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.log('\n🚀 Начало миграции Team → TeamNew');
  console.log(`   Режим: ${isDryRun ? '🔍 DRY RUN (без изменений)' : '✍️  ЗАПИСЬ В БД'}`);

  const payload = await getPayload({ config });

  try {
    // 1. Читаем все записи из старой коллекции Team
    console.log('\n📖 Чтение team members из коллекции Team...');
    const oldTeamMembers = (await payload.find({
      collection: 'team' as any,
      limit: 1000,
      depth: 0,
    })) as { docs: OldTeamMember[] };

    console.log(`   Найдено: ${oldTeamMembers.docs.length} team members\n`);

    const stats = {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    };

    // 2. Мигрируем каждого team member
    for (const oldMember of oldTeamMembers.docs) {
      stats.processed++;
      console.log(`\n[${stats.processed}/${oldTeamMembers.docs.length}] Обработка: ${oldMember.name} (id: ${oldMember.id})`);

      try {
        // Базовые данные (общие для всех языков)
        const photoId = extractMediaId(oldMember.photo);
        const seoImageId = extractMediaId(oldMember.seo?.og_image);

        // Маппинг языков: из старых translations в нативные локали Payload
        const localeMap: Record<'ru' | 'uk' | 'en', any> = {
          ru: {
            name: oldMember.name,
            position: oldMember.position,
            bio_summary: preserveLexicalJSON(oldMember.bio_summary),
            bio: preserveLexicalJSON(oldMember.bio),
            seo_title: oldMember.seo?.title || '',
            seo_description: oldMember.seo?.meta_description || '',
            focus_keyphrase: oldMember.seo?.focus_keyphrase || '',
            link_keywords: oldMember.seo?.additional_fields?.link_keywords || '',
          },
          uk: { name: '', position: '', bio_summary: undefined, bio: undefined, seo_title: '', seo_description: '', focus_keyphrase: '', link_keywords: '' },
          en: { name: '', position: '', bio_summary: undefined, bio: undefined, seo_title: '', seo_description: '', focus_keyphrase: '', link_keywords: '' },
        };

        // Заполняем переводы из старого translations array
        if (oldMember.translations && Array.isArray(oldMember.translations)) {
          for (const trans of oldMember.translations) {
            const lang = trans.language === 'ua' ? 'uk' : trans.language; // ua → uk
            if (lang in localeMap) {
              localeMap[lang] = {
                name: trans.name || localeMap[lang].name,
                position: trans.position || localeMap[lang].position,
                bio_summary: preserveLexicalJSON(trans.bio_summary) || localeMap[lang].bio_summary,
                bio: preserveLexicalJSON(trans.bio) || localeMap[lang].bio,
                seo_title: trans.seo?.title || localeMap[lang].seo_title,
                seo_description: trans.seo?.meta_description || localeMap[lang].seo_description,
                focus_keyphrase: trans.seo?.focus_keyphrase || localeMap[lang].focus_keyphrase,
                link_keywords: trans.seo?.additional_fields?.link_keywords || localeMap[lang].link_keywords,
              };
            }
          }
        }

        // Нормализация links (twitter → x)
        const normalizedLinks = oldMember.links?.map(link => ({
          service: link.service === 'twitter' ? 'x' : link.service, // twitter → x
          url: link.url,
        })) || [];

        if (isDryRun) {
          console.log('   🔍 DRY RUN: Данные для миграции:');
          console.log(`      - RU: ${localeMap.ru.name} - ${localeMap.ru.position}`);
          console.log(`      - UK: ${localeMap.uk.name || '(нет перевода)'}`);
          console.log(`      - EN: ${localeMap.en.name || '(нет перевода)'}`);
          console.log(`      - Photo: ${photoId || 'нет'}`);
          console.log(`      - Links: ${normalizedLinks.length}`);
          stats.skipped++;
          continue;
        }

        // Создаем запись в TeamNew с дефолтной локалью (ru)
        const newMember = await payload.create({
          collection: 'team-new',
          data: {
            name: localeMap.ru.name,
            slug: oldMember.slug,
            position: localeMap.ru.position,
            bio_summary: localeMap.ru.bio_summary,
            bio: localeMap.ru.bio,
            photo: photoId,
            order: oldMember.order || 0,
            links: normalizedLinks,
            seo: {
              title: localeMap.ru.seo_title,
              meta_description: localeMap.ru.seo_description,
              og_image: seoImageId,
              focus_keyphrase: localeMap.ru.focus_keyphrase,
              link_keywords: localeMap.ru.link_keywords,
              no_index: oldMember.seo?.no_index || false,
              no_follow: oldMember.seo?.no_follow || false,
            },
            posts: [], // Связи с постами добавим позже
            faqs: [], // FAQs пока пустые (добавим позже при необходимости)
            _status: 'published',
          },
          locale: 'ru',
        } as any);

        console.log(`   ✅ Создан (RU): ${newMember.id}`);

        // Обновляем локали UK и EN, если есть переводы
        for (const locale of ['uk', 'en'] as const) {
          const localeData = localeMap[locale];
          
          // Пропускаем пустые переводы
          if (!localeData.name && !localeData.position) {
            console.log(`   ⏭️  Пропущен (${locale.toUpperCase()}): нет перевода`);
            continue;
          }

          await payload.update({
            collection: 'team-new',
            id: newMember.id,
            data: {
              name: localeData.name,
              position: localeData.position,
              bio_summary: localeData.bio_summary,
              bio: localeData.bio,
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
        console.error(`   ❌ Ошибка миграции team member ${oldMember.name}:`, error);
      }
    }

    console.log('\n============================================================');
    console.log('📊 РЕЗУЛЬТАТЫ МИГРАЦИИ:');
    console.log('============================================================');
    console.log(`Обработано:  ${stats.processed}`);
    console.log(`Создано:     ${stats.created}`);
    console.log(`Пропущено:   ${stats.skipped}`);
    console.log(`Ошибок:      ${stats.errors}`);
    console.log('============================================================\n');

    console.log('✨ Миграция завершена!\n');

    if (!isDryRun) {
      console.log('📝 Следующие шаги:');
      console.log('   1. Проверьте данные в TeamNew через админку');
      console.log('   2. Убедитесь что все переводы корректны');
      console.log('   3. Проверьте фотографии и контакты');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Критическая ошибка миграции:', error);
    process.exit(1);
  }
}

migrateTeamToLocalized();
