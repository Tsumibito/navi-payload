#!/usr/bin/env tsx
/**
 * Миграционный скрипт: Posts → PostsNew
 *
 * Безопасная миграция из старой схемы (translations array)
 * в новую схему (нативная локализация Payload)
 *
 * Использование:
 * - Dry-run (без изменений): pnpm migrate:posts-localized --dry-run
 * - С ограничением: pnpm migrate:posts-localized --limit=5
 * - Полная миграция: pnpm migrate:posts-localized
 */

import { getPayload } from 'payload';
import config from '../src/payload.config';

type OldPost = {
  id: string | number;
  name: string;
  slug: string;
  published_at: string;
  image?: string | number | { id: string | number };
  featured?: boolean;
  summary?: string;
  content?: any; // JSONB - Lexical
  author?: string | number | { id: string | number };
  tags?: Array<string | number | { id: string | number }>;
  socialImages?: {
    thumbnail?: string | number | { id: string | number };
    image16x9?: string | number | { id: string | number };
    image5x4?: string | number | { id: string | number };
  };
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
    slug?: string;
    name?: string;
    summary?: string;
    content?: any;
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

const extractRelationId = (field: string | number | { id: string | number } | { relationTo: string; value: any } | undefined): number | undefined => {
  if (!field) return undefined;
  if (typeof field === 'string') return parseInt(field, 10);
  if (typeof field === 'number') return field;
  // Проверяем формат Payload depth>0: { relationTo: '...', value: { id: ... } }
  if ('relationTo' in field && field.value) {
    const val = field.value;
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && val.id) {
      return typeof val.id === 'string' ? parseInt(val.id, 10) : val.id;
    }
  }
  // Обычный формат: { id: ... }
  if ('id' in field) {
    return typeof field.id === 'string' ? parseInt(field.id, 10) : field.id;
  }
  return undefined;
};

// Функция для очистки Lexical JSON от вложенных объектов (upload nodes)
const cleanLexicalUploads = (node: any): any => {
  if (!node || typeof node !== 'object') return node;

  // Если это upload node с объектом value вместо ID
  if (node.type === 'upload' && node.value && typeof node.value === 'object') {
    return {
      ...node,
      value: node.value.id || node.value, // Берём только ID
    };
  }

  // Рекурсивно обрабатываем children
  if (Array.isArray(node.children)) {
    return {
      ...node,
      children: node.children.map(cleanLexicalUploads),
    };
  }

  // Обрабатываем root
  if (node.root) {
    return {
      ...node,
      root: cleanLexicalUploads(node.root),
    };
  }

  return node;
};

// Функция для сохранения Lexical JSON с очисткой upload-узлов
const preserveLexicalJSON = (lexicalData: any): any => {
  if (!lexicalData) return undefined;
  
  let parsed = lexicalData;
  
  // Если это строка - парсим
  if (typeof lexicalData === 'string') {
    try {
      parsed = JSON.parse(lexicalData);
    } catch {
      // Если не JSON - оборачиваем в простой параграф
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

  // Очищаем от вложенных объектов
  return cleanLexicalUploads(parsed);
};

async function migratePostsToLocalized() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  console.log('\n🚀 Начало миграции Posts → PostsNew');
  console.log(`   Режим: ${isDryRun ? '🔍 DRY RUN (без изменений)' : '✍️  ЗАПИСЬ В БД'}`);
  if (limit) console.log(`   Лимит: ${limit} записей`);

  const payload = await getPayload({ config });

  try {
    // 1. Читаем все записи из старой коллекции Posts
    console.log('\n📖 Чтение posts из коллекции Posts...');
    const oldPosts = (await payload.find({
      collection: 'posts' as any,
      limit: limit || 1000,
      depth: 1, // Загружаем связи
    })) as { docs: OldPost[] };

    console.log(`   Найдено: ${oldPosts.docs.length} posts\n`);

    const stats = {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0,
    };

    // 2. Создаём маппинг старых ID тегов → новые ID (Tags → TagsNew)
    console.log('🔗 Создание маппинга Tags → TagsNew...');
    const oldTagsData = await payload.find({
      collection: 'tags' as any,
      limit: 1000,
      depth: 0,
    });
    const newTagsData = await payload.find({
      collection: 'tags-new',
      limit: 1000,
      depth: 0,
    });

    const tagsMapping = new Map<number, number>();
    for (const oldTag of (oldTagsData as any).docs) {
      const newTag = (newTagsData as any).docs.find((nt: any) => nt.slug === oldTag.slug);
      if (newTag) {
        tagsMapping.set(Number(oldTag.id), Number(newTag.id));
      }
    }
    console.log(`   Создан маппинг для ${tagsMapping.size} тегов\n`);

    // 3. Создаём маппинг старых ID авторов → новые ID (Team → TeamNew)
    console.log('🔗 Создание маппинга Team → TeamNew...');
    const oldTeamData = await payload.find({
      collection: 'team' as any,
      limit: 1000,
      depth: 0,
    });
    const newTeamData = await payload.find({
      collection: 'team-new',
      limit: 1000,
      depth: 0,
    });

    const teamMapping = new Map<number, number>();
    for (const oldMember of (oldTeamData as any).docs) {
      const newMember = (newTeamData as any).docs.find((nm: any) => nm.slug === oldMember.slug);
      if (newMember) {
        teamMapping.set(Number(oldMember.id), Number(newMember.id));
      }
    }
    console.log(`   Создан маппинг для ${teamMapping.size} team members\n`);

    // 4. Мигрируем каждый пост
    for (const oldPost of oldPosts.docs) {
      stats.processed++;
      console.log(`\n[${stats.processed}/${oldPosts.docs.length}] Обработка: ${oldPost.name} (id: ${oldPost.id})`);

      try {
        // Базовые данные (общие для всех языков)
        const imageId = extractMediaId(oldPost.image);
        const thumbnailId = extractMediaId(oldPost.socialImages?.thumbnail);
        const image16x9Id = extractMediaId(oldPost.socialImages?.image16x9);
        const image5x4Id = extractMediaId(oldPost.socialImages?.image5x4);
        const seoImageId = extractMediaId(oldPost.seo?.og_image);

        // Маппинг author
        const oldAuthorId = extractRelationId(oldPost.author);
        const newAuthorId = oldAuthorId ? teamMapping.get(oldAuthorId) : undefined;

        // Маппинг tags
        const oldTagIds = oldPost.tags?.map(extractRelationId).filter(Boolean) as number[] || [];
        const newTagIds = oldTagIds.map(oldId => tagsMapping.get(oldId)).filter(Boolean) as number[];

        console.log(`   Author: ${oldAuthorId} → ${newAuthorId || 'не найден'}`);
        console.log(`   Tags: ${oldTagIds.length} → ${newTagIds.length} mapped`);

        // Маппинг языков
        const localeMap: Record<'ru' | 'uk' | 'en', any> = {
          ru: {
            name: oldPost.name,
            slug: oldPost.slug,
            summary: oldPost.summary || '',
            content: preserveLexicalJSON(oldPost.content),
            seo_title: oldPost.seo?.title || '',
            seo_description: oldPost.seo?.meta_description || '',
            focus_keyphrase: oldPost.seo?.focus_keyphrase || '',
            link_keywords: oldPost.seo?.additional_fields?.link_keywords || '',
          },
          uk: { name: '', slug: '', summary: '', content: undefined, seo_title: '', seo_description: '', focus_keyphrase: '', link_keywords: '' },
          en: { name: '', slug: '', summary: '', content: undefined, seo_title: '', seo_description: '', focus_keyphrase: '', link_keywords: '' },
        };

        // Заполняем переводы
        if (oldPost.translations && Array.isArray(oldPost.translations)) {
          for (const trans of oldPost.translations) {
            const lang = trans.language === 'ua' ? 'uk' : trans.language;
            if (lang in localeMap) {
              localeMap[lang] = {
                name: trans.name || localeMap[lang].name,
                slug: trans.slug || localeMap[lang].slug,
                summary: trans.summary || localeMap[lang].summary,
                content: preserveLexicalJSON(trans.content) || localeMap[lang].content,
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
          console.log(`      - RU: ${localeMap.ru.name}`);
          console.log(`      - UK: ${localeMap.uk.name || '(нет перевода)'}`);
          console.log(`      - EN: ${localeMap.en.name || '(нет перевода)'}`);
          console.log(`      - Author: ${newAuthorId || 'нет'}`);
          console.log(`      - Tags: ${newTagIds.length}`);
          stats.skipped++;
          continue;
        }

        // Создаем запись в PostsNew с дефолтной локалью (ru)
        const newPost = await payload.create({
          collection: 'posts-new',
          data: {
            name: localeMap.ru.name,
            slug: localeMap.ru.slug,
            image: imageId,
            featured: oldPost.featured || false,
            summary: localeMap.ru.summary,
            content: localeMap.ru.content,
            author: newAuthorId,
            tags: newTagIds,
            socialImages: (thumbnailId || image16x9Id || image5x4Id) ? {
              thumbnail: thumbnailId,
              image16x9: image16x9Id,
              image5x4: image5x4Id,
            } : undefined,
            seo: {
              title: localeMap.ru.seo_title,
              meta_description: localeMap.ru.seo_description,
              og_image: seoImageId,
              focus_keyphrase: localeMap.ru.focus_keyphrase,
              link_keywords: localeMap.ru.link_keywords,
              no_index: oldPost.seo?.no_index || false,
              no_follow: oldPost.seo?.no_follow || false,
            },
            faqs: [],
            _status: 'published',
            createdAt: oldPost.published_at, // Используем published_at как дату создания
          },
          locale: 'ru',
        } as any);

        console.log(`   ✅ Создан (RU): ${newPost.id}`);

        // Обновляем created_at на published_at напрямую в БД
        if (oldPost.published_at) {
          await payload.db.pool.query(
            `UPDATE navi.posts_new SET created_at = $1 WHERE id = $2`,
            [oldPost.published_at, newPost.id]
          );
        }

        // Обновляем локали UK и EN, если есть переводы
        for (const locale of ['uk', 'en'] as const) {
          const localeData = localeMap[locale];
          
          if (!localeData.name && !localeData.summary) {
            console.log(`   ⏭️  Пропущен (${locale.toUpperCase()}): нет перевода`);
            continue;
          }

          await payload.update({
            collection: 'posts-new',
            id: newPost.id,
            data: {
              name: localeData.name,
              slug: localeData.slug,
              summary: localeData.summary,
              content: localeData.content,
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
        console.error(`   ❌ Ошибка миграции поста ${oldPost.name}:`, error);
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
      console.log('   1. Проверьте данные в PostsNew через админку');
      console.log('   2. Убедитесь что все переводы корректны');
      console.log('   3. Проверьте связи с авторами и тегами');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Критическая ошибка миграции:', error);
    process.exit(1);
  }
}

migratePostsToLocalized();
