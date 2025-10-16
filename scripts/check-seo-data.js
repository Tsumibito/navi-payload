/**
 * Проверка данных SEO в БД
 */

const { Client } = require('pg');
require('dotenv').config();

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Проверяем данные для поста 4
    console.log('📋 Checking seo-stats for post 4:\n');
    const result = await client.query(`
      SELECT id, entity_type, entity_id, locale, focus_keyphrase,
             CASE 
               WHEN link_keywords IS NOT NULL 
               THEN jsonb_array_length(link_keywords->'keywords')
               ELSE 0
             END as keywords_count,
             created_at, updated_at
      FROM navi."seo-stats"
      WHERE entity_type = 'posts-new' 
        AND entity_id = '4'
      ORDER BY locale
    `);

    if (result.rows.length === 0) {
      console.log('❌ No data found for post 4');
    } else {
      console.table(result.rows);
    }

    // 2. Показываем Link Keywords детально
    console.log('\n📋 Link Keywords details:\n');
    const keywords = await client.query(`
      SELECT locale, 
             jsonb_pretty(link_keywords) as link_keywords_pretty
      FROM navi."seo-stats"
      WHERE entity_type = 'posts-new' 
        AND entity_id = '4'
        AND link_keywords IS NOT NULL
      ORDER BY locale
    `);

    for (const row of keywords.rows) {
      console.log(`\n=== ${row.locale.toUpperCase()} ===`);
      console.log(row.link_keywords_pretty);
    }

    // 3. Проверяем все записи
    console.log('\n📋 All seo-stats records:\n');
    const all = await client.query(`
      SELECT entity_type, entity_id, locale, focus_keyphrase,
             CASE 
               WHEN link_keywords IS NOT NULL 
               THEN jsonb_array_length(link_keywords->'keywords')
               ELSE 0
             END as keywords_count
      FROM navi."seo-stats"
      ORDER BY entity_type, entity_id, locale
    `);

    console.table(all.rows);

    await client.end();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    try {
      await client.end();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

check();
