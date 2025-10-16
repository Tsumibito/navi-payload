/**
 * Импорт Link Keywords из Baserow для RU и EN локалей
 * 
 * Baserow Table: Blog Posts (356544)
 * Fields:
 * - field_2896460: keywords we target RU
 * - field_2933062: keywords we target EN
 * - field_2933061: keywords we target UA
 * - field_2660067: Name_RU (для сопоставления)
 * - field_2660068: Slug
 */

const { Client } = require('pg');
const https = require('https');
require('dotenv').config();

// Простой fetch через https
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: () => Promise.resolve(JSON.parse(data)),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const BASEROW_API_KEY = process.env.BASEROW_API_KEY;
const BASEROW_TABLE_ID = '356544'; // Blog Posts
const BASEROW_API_URL = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/`;

async function importLinkKeywords() {
  console.log('🚀 Starting: Import Link Keywords from Baserow\n');
  
  if (!BASEROW_API_KEY) {
    console.error('❌ BASEROW_API_KEY not found in .env');
    process.exit(1);
  }

  const pgClient = new Client({
    connectionString: process.env.DATABASE_URI,
  });

  try {
    // 1. Подключаемся к БД
    await pgClient.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // 2. Загружаем посты из Baserow
    console.log('📋 Fetching posts from Baserow...');
    const response = await fetch(BASEROW_API_URL + '?user_field_names=true&size=200', {
      headers: {
        'Authorization': `Token ${BASEROW_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Baserow API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const baserowPosts = data.results;
    
    console.log(`✅ Loaded ${baserowPosts.length} posts from Baserow\n`);

    // 3. Загружаем посты из Payload (с локализованными полями)
    console.log('📋 Loading posts from Payload...');
    const payloadPosts = await pgClient.query(`
      SELECT DISTINCT 
        p.id::text as id,
        pl.name,
        pl.slug
      FROM navi.posts_new p
      INNER JOIN navi.posts_new_locales pl ON p.id = pl._parent_id
      WHERE pl._locale = 'ru'
    `);
    
    console.log(`✅ Loaded ${payloadPosts.rows.length} posts from Payload\n`);

    // 4. Для каждого поста из Baserow ищем соответствие в Payload
    let importedCount = 0;
    let skippedCount = 0;
    
    console.log('📋 Processing posts...\n');

    for (const baserowPost of baserowPosts) {
      const nameRU = baserowPost['Name_RU'];
      const keywordsRU = baserowPost['keywords we target RU'];
      const keywordsEN = baserowPost['keywords we target EN'];
      const keywordsUA = baserowPost['keywords we target UA'];

      if (!nameRU) {
        skippedCount++;
        continue;
      }

      // Ищем пост в Payload по названию (приблизительное совпадение)
      const payloadPost = payloadPosts.rows.find(p => {
        const nameMatch = p.name && p.name.toLowerCase().includes(nameRU.toLowerCase().substring(0, 20));
        return nameMatch;
      });

      if (!payloadPost) {
        console.log(`⚠️  Post not found in Payload: "${nameRU.substring(0, 50)}..."`);
        skippedCount++;
        continue;
      }

      // Парсим ключевые слова (CSV → массив)
      const parseKeywords = (csvString) => {
        if (!csvString || csvString.trim() === '') return [];
        return csvString
          .split(',')
          .map(k => k.trim())
          .filter(k => k.length > 0)
          .map(keyword => ({
            keyword,
            notes: '',
            linksCount: 0,
            potentialLinksCount: 0,
            cachedTotal: 0,
            cachedHeadings: 0,
          }));
      };

      const ruKeywords = parseKeywords(keywordsRU);
      const enKeywords = parseKeywords(keywordsEN);
      const uaKeywords = parseKeywords(keywordsUA);

      // Обновляем/создаём записи для RU, EN, UK (не ua!)
      const locales = [
        { locale: 'ru', keywords: ruKeywords },
        { locale: 'en', keywords: enKeywords },
        { locale: 'uk', keywords: uaKeywords },
      ];

      for (const { locale, keywords } of locales) {
        if (keywords.length === 0) continue;

        const linkKeywordsData = {
          keywords,
          statsSignature: `imported_${Date.now()}`,
          statsUpdatedAt: new Date().toISOString(),
        };

        // Проверяем существует ли запись
        const existing = await pgClient.query(`
          SELECT id FROM navi."seo-stats"
          WHERE entity_type = 'posts-new'
            AND entity_id = $1
            AND locale = $2
        `, [payloadPost.id.toString(), locale]);

        if (existing.rows.length > 0) {
          // Обновляем
          await pgClient.query(`
            UPDATE navi."seo-stats"
            SET link_keywords = $1,
                updated_at = NOW()
            WHERE entity_type = 'posts-new'
              AND entity_id = $2
              AND locale = $3
          `, [JSON.stringify(linkKeywordsData), payloadPost.id.toString(), locale]);
          
          console.log(`  ✅ Updated: ${payloadPost.name} (${locale}) - ${keywords.length} keywords`);
        } else {
          // Создаём новую запись
          await pgClient.query(`
            INSERT INTO navi."seo-stats" 
              (entity_type, entity_id, locale, focus_keyphrase, stats, link_keywords, created_at, updated_at)
            VALUES 
              ('posts-new', $1, $2, '', '{}'::jsonb, $3, NOW(), NOW())
          `, [payloadPost.id.toString(), locale, JSON.stringify(linkKeywordsData)]);
          
          console.log(`  ✅ Created: ${payloadPost.name} (${locale}) - ${keywords.length} keywords`);
        }

        importedCount++;
      }
    }

    // 5. Финальная статистика
    console.log('\n📋 Final statistics:\n');
    const stats = await pgClient.query(`
      SELECT locale, COUNT(*) as count,
             SUM(CASE 
               WHEN link_keywords IS NOT NULL 
               THEN jsonb_array_length(link_keywords->'keywords')
               ELSE 0
             END) as total_keywords
      FROM navi."seo-stats"
      WHERE entity_type = 'posts-new'
      GROUP BY locale
      ORDER BY locale
    `);

    console.table(stats.rows);

    console.log(`\n🎉 Import completed!`);
    console.log(`✅ Imported: ${importedCount} records`);
    console.log(`⚠️  Skipped: ${skippedCount} posts (not found or no keywords)\n`);

    await pgClient.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    
    try {
      await pgClient.end();
    } catch (e) {
      // ignore
    }
    
    process.exit(1);
  }
}

importLinkKeywords();
