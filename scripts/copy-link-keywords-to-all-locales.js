/**
 * Копирование Link Keywords с locale='uk' на 'ru' и 'en'
 * 
 * При миграции все данные получили locale='uk' по умолчанию.
 * Этот скрипт копирует Link Keywords на все остальные локали.
 */

const { Client } = require('pg');
require('dotenv').config();

async function copyLinkKeywords() {
  console.log('🚀 Starting: Copy Link Keywords to all locales\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Находим все записи с locale='uk' у которых есть link_keywords
    console.log('📋 Step 1: Finding records with Link Keywords (locale=uk)...');
    const ukRecords = await client.query(`
      SELECT id, entity_type, entity_id, locale, link_keywords,
             focus_keyphrase, stats, calculated_at
      FROM navi."seo-stats"
      WHERE locale = 'uk' 
        AND link_keywords IS NOT NULL
        AND jsonb_array_length(link_keywords->'keywords') > 0
      ORDER BY entity_type, entity_id
    `);

    if (ukRecords.rows.length === 0) {
      console.log('ℹ️  No records with Link Keywords found for locale=uk');
      await client.end();
      process.exit(0);
    }

    console.log(`✅ Found ${ukRecords.rows.length} records with Link Keywords\n`);
    console.table(ukRecords.rows.map(r => ({
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      keywords_count: r.link_keywords?.keywords?.length || 0,
      focus_keyphrase: r.focus_keyphrase?.substring(0, 30) + '...',
    })));

    // 2. Для каждой записи копируем на ru и en
    console.log('\n📋 Step 2: Copying to ru and en locales...\n');
    
    let copiedCount = 0;
    const targetLocales = ['ru', 'en'];

    for (const record of ukRecords.rows) {
      for (const targetLocale of targetLocales) {
        // Проверяем, есть ли уже запись для этой локали
        const existing = await client.query(`
          SELECT id, link_keywords
          FROM navi."seo-stats"
          WHERE entity_type = $1
            AND entity_id = $2
            AND locale = $3
        `, [record.entity_type, record.entity_id, targetLocale]);

        if (existing.rows.length > 0) {
          // Запись существует - обновляем только link_keywords
          await client.query(`
            UPDATE navi."seo-stats"
            SET link_keywords = $1,
                updated_at = NOW()
            WHERE entity_type = $2
              AND entity_id = $3
              AND locale = $4
          `, [
            JSON.stringify(record.link_keywords),
            record.entity_type,
            record.entity_id,
            targetLocale
          ]);

          console.log(`  ✅ Updated: ${record.entity_type}/${record.entity_id} → ${targetLocale}`);
        } else {
          // Записи нет - создаём новую
          await client.query(`
            INSERT INTO navi."seo-stats" 
              (entity_type, entity_id, locale, focus_keyphrase, stats, link_keywords, calculated_at, created_at, updated_at)
            VALUES 
              ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          `, [
            record.entity_type,
            record.entity_id,
            targetLocale,
            record.focus_keyphrase,
            JSON.stringify(record.stats),
            JSON.stringify(record.link_keywords),
            record.calculated_at
          ]);

          console.log(`  ✅ Created: ${record.entity_type}/${record.entity_id} → ${targetLocale}`);
        }

        copiedCount++;
      }
    }

    // 3. Проверяем результат
    console.log('\n📋 Step 3: Verifying results...\n');
    
    const finalCheck = await client.query(`
      SELECT entity_type, entity_id, locale,
             CASE 
               WHEN link_keywords IS NOT NULL 
               THEN jsonb_array_length(link_keywords->'keywords')
               ELSE 0
             END as keywords_count
      FROM navi."seo-stats"
      WHERE entity_type IN (
        SELECT DISTINCT entity_type 
        FROM navi."seo-stats" 
        WHERE locale = 'uk' 
          AND link_keywords IS NOT NULL
      )
      ORDER BY entity_type, entity_id, locale
    `);

    console.log('📊 Final state:');
    console.table(finalCheck.rows);

    console.log(`\n🎉 Success!`);
    console.log(`✅ Copied Link Keywords to ${copiedCount} records`);
    console.log(`✅ Total records with Link Keywords: ${finalCheck.rows.length}`);
    console.log('\n💡 Now Link Keywords are available in all locales (uk, ru, en)!\n');

    await client.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    
    try {
      await client.end();
    } catch (e) {
      // ignore
    }
    
    process.exit(1);
  }
}

copyLinkKeywords();
