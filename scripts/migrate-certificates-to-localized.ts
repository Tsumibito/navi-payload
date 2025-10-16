import { getPayload } from 'payload';
import config from '../src/payload.config';

type OldCertificate = {
  id: string | number;
  title: string;
  slug: string;
  frontImage?: string | number | { id: string | number };
  backImage?: string | number | { id: string | number };
  description?: any;
  requirements?: any;
  program?: any;
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
    language: string;
    title?: string;
    slug?: string;
    description?: any;
    requirements?: any;
    program?: any;
    frontImage?: string | number | { id: string | number };
    backImage?: string | number | { id: string | number };
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
  if (typeof field === 'object' && 'id' in field) {
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
      value: node.value.id || node.value,
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

async function migrateCertificatesToLocalized() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  console.log('\n🚀 Начало миграции Certificates → CertificatesNew');
  console.log(`   Режим: ${isDryRun ? '🔍 DRY RUN (без изменений)' : '✍️  ЗАПИСЬ В БД'}`);
  if (limit) console.log(`   Лимит: ${limit} записей`);

  const payload = await getPayload({ config });

  const stats = {
    processed: 0,
    created: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Читаем все certificates из старой коллекции
    console.log('\n📖 Чтение certificates из коллекции Certificates...');
    const oldCertificates = (await payload.find({
      collection: 'certificates' as any,
      limit: limit || 1000,
      depth: 0,
    })) as { docs: OldCertificate[] };

    console.log(`   Найдено: ${oldCertificates.docs.length} certificates\n`);

    // Обрабатываем каждый certificate
    for (const [index, oldCert] of oldCertificates.docs.entries()) {
      stats.processed++;
      
      console.log(`\n[${index + 1}/${oldCertificates.docs.length}] Обработка: ${oldCert.title} (id: ${oldCert.id})`);

      if (isDryRun) {
        console.log('   🔍 DRY RUN: пропущен');
        continue;
      }

      try {
        // Извлекаем ID изображений
        const frontImageId = extractMediaId(oldCert.frontImage);
        const backImageId = extractMediaId(oldCert.backImage);
        const seoImageId = extractMediaId(oldCert.seo?.og_image);

        // Маппинг языков
        const localeMap: Record<'ru' | 'uk' | 'en', any> = {
          ru: {
            title: oldCert.title,
            slug: oldCert.slug,
            description: preserveLexicalJSON(oldCert.description),
            requirements: preserveLexicalJSON(oldCert.requirements),
            program: preserveLexicalJSON(oldCert.program),
            seo_title: oldCert.seo?.title || '',
            seo_description: oldCert.seo?.meta_description || '',
            focus_keyphrase: oldCert.seo?.focus_keyphrase || '',
            link_keywords: oldCert.seo?.additional_fields?.link_keywords || '',
          },
          uk: { title: '', slug: '', description: undefined, requirements: undefined, program: undefined, seo_title: '', seo_description: '', focus_keyphrase: '', link_keywords: '' },
          en: { title: '', slug: '', description: undefined, requirements: undefined, program: undefined, seo_title: '', seo_description: '', focus_keyphrase: '', link_keywords: '' },
        };

        // Заполняем переводы
        if (oldCert.translations && Array.isArray(oldCert.translations)) {
          for (const trans of oldCert.translations) {
            const lang = trans.language === 'ua' ? 'uk' : trans.language;
            if (lang in localeMap) {
              localeMap[lang] = {
                title: trans.title || localeMap[lang].title,
                slug: trans.slug || localeMap[lang].slug,
                description: preserveLexicalJSON(trans.description) || localeMap[lang].description,
                requirements: preserveLexicalJSON(trans.requirements) || localeMap[lang].requirements,
                program: preserveLexicalJSON(trans.program) || localeMap[lang].program,
                seo_title: trans.seo?.title || localeMap[lang].seo_title,
                seo_description: trans.seo?.meta_description || localeMap[lang].seo_description,
                focus_keyphrase: trans.seo?.focus_keyphrase || localeMap[lang].focus_keyphrase,
                link_keywords: trans.seo?.additional_fields?.link_keywords || localeMap[lang].link_keywords,
              };
            }
          }
        }

        // Создаем запись в CertificatesNew с дефолтной локалью (ru)
        const newCert = await payload.create({
          collection: 'certificates-new',
          data: {
            title: localeMap.ru.title,
            slug: localeMap.ru.slug,
            frontImage: frontImageId,
            backImage: backImageId,
            description: localeMap.ru.description,
            requirements: localeMap.ru.requirements,
            program: localeMap.ru.program,
            seo: {
              title: localeMap.ru.seo_title,
              meta_description: localeMap.ru.seo_description,
              og_image: seoImageId,
              focus_keyphrase: localeMap.ru.focus_keyphrase,
              link_keywords: localeMap.ru.link_keywords,
              no_index: oldCert.seo?.no_index || false,
              no_follow: oldCert.seo?.no_follow || false,
            },
            _status: 'published',
          },
          locale: 'ru',
        } as any);

        console.log(`   ✅ Создан (RU): ${newCert.id}`);
        stats.created++;

        // Обновляем created_at на значение из старой записи
        if (oldCert.id) {
          await payload.db.pool.query(
            `UPDATE navi.certificates_new 
             SET created_at = (SELECT created_at FROM navi.certificates WHERE id = $1)
             WHERE id = $2`,
            [oldCert.id, newCert.id]
          );
        }

        // Обновляем локали UK и EN, если есть переводы
        for (const locale of ['uk', 'en'] as const) {
          const localeData = localeMap[locale];
          
          if (!localeData.title) {
            console.log(`   ⏭️  Пропущен (${locale.toUpperCase()}): нет перевода`);
            continue;
          }

          await payload.update({
            collection: 'certificates-new',
            id: newCert.id,
            data: {
              title: localeData.title,
              slug: localeData.slug,
              description: localeData.description,
              requirements: localeData.requirements,
              program: localeData.program,
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

      } catch (error: any) {
        console.log(`   ❌ Ошибка миграции сертификата ${oldCert.title}: ${error.message}`);
        stats.errors++;
      }
    }

  } catch (error: any) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  }

  // Финальная статистика
  console.log('\n============================================================');
  console.log('📊 РЕЗУЛЬТАТЫ МИГРАЦИИ:');
  console.log('============================================================');
  console.log('Обработано: ', stats.processed);
  console.log('Создано:    ', stats.created);
  console.log('Пропущено:  ', stats.skipped);
  console.log('Ошибок:     ', stats.errors);
  console.log('============================================================\n');

  console.log('✨ Миграция завершена!');
  console.log('\n📝 Следующие шаги:');
  console.log('   1. Проверьте данные в CertificatesNew через админку');
  console.log('   2. Убедитесь что все переводы корректны');
  console.log('   3. Проверьте изображения (front/back)');

  process.exit(0);
}

migrateCertificatesToLocalized();
