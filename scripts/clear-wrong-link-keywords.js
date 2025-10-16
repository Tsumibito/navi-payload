/**
 * Очистка неправильно скопированных Link Keywords для RU и EN
 * 
 * После миграции мы скопировали украинские ключи на все языки,
 * но это неправильно - для каждого языка должны быть свои ключи.
 * 
 * Этот скрипт очищает link_keywords для locale='ru' и 'en',
 * чтобы пользователь мог заполнить правильные ключи для каждого языка.
 */

const { Client } = require('pg');
require('dotenv').config();

async function clearWrongKeywords() {
  console.log('🚀 Starting: Clear wrong Link Keywords for RU and EN\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Показываем что будем очищать
    console.log('📋 Records with Link Keywords (will be cleared for ru/en):\n');
    const toClean = await client.query(`
      SELECT entity_type, entity_id, locale,
             jsonb_array_length(link_keywords->'keywords') as keywords_count
      FROM navi."seo-stats"
      WHERE locale IN ('ru', 'en')
        AND link_keywords IS NOT NULL
        AND jsonb_array_length(link_keywords->'keywords') > 0
      ORDER BY entity_type, entity_id, locale
    `);

    if (toClean.rows.length === 0) {
      console.log('ℹ️  No Link Keywords found for ru/en locales. Nothing to clean.');
      await client.end();
      process.exit(0);
    }

    console.table(toClean.rows);
    console.log(`\n⚠️  Will clear Link Keywords for ${toClean.rows.length} records\n`);

    // 2. Очищаем link_keywords для RU и EN
    console.log('📋 Clearing Link Keywords...\n');
    
    const result = await client.query(`
      UPDATE navi."seo-stats"
      SET link_keywords = NULL,
          updated_at = NOW()
      WHERE locale IN ('ru', 'en')
        AND link_keywords IS NOT NULL
      RETURNING entity_type, entity_id, locale
    `);

    console.log(`✅ Cleared ${result.rowCount} records\n`);

    // 3. Проверяем результат
    console.log('📋 Final state:\n');
    const final = await client.query(`
      SELECT entity_type, entity_id, locale,
             CASE 
               WHEN link_keywords IS NOT NULL 
               THEN jsonb_array_length(link_keywords->'keywords')
               ELSE 0
             END as keywords_count
      FROM navi."seo-stats"
      WHERE entity_id IN ('4', '16', '21', '22', '25', '44')
      ORDER BY entity_type, entity_id, locale
    `);

    console.table(final.rows);

    console.log('\n🎉 Done!');
    console.log('\n✅ Link Keywords cleared for RU and EN locales');
    console.log('✅ UK locale kept unchanged (original data)');
    console.log('\n💡 Now you can add correct keywords for each language:\n');
    console.log('  RU: "виды яхтенных прав", "шкиперские сертификаты"');
    console.log('  EN: "types of yacht licenses", "skipper certificates"');
    console.log('  UK: "види яхтових прав", "шкіперські сертифікати" (kept)\n');

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

clearWrongKeywords();
