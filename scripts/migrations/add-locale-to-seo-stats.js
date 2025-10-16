/**
 * Миграция: Добавление колонки locale в таблицу seo-stats
 * 
 * Эта миграция добавляет поддержку мультиязычности для SEO статистики.
 * Каждая локаль (ru, ua, en) будет иметь свои отдельные данные.
 */

const { getPayload } = require('payload');
const config = require('../../dist/payload.config.js').default;

async function migrate() {
  console.log('🚀 Starting migration: add locale to seo-stats');
  
  try {
    const payload = await getPayload({ config });
    const db = payload.db.drizzle;

    // 1. Проверяем, существует ли колонка locale
    console.log('📋 Step 1: Checking if locale column exists...');
    const checkColumn = await db.execute(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'navi' 
        AND table_name = 'seo-stats' 
        AND column_name = 'locale'
    `);

    if (checkColumn.rows && checkColumn.rows.length > 0) {
      console.log('✅ Column locale already exists. Skipping migration.');
      process.exit(0);
    }

    // 2. Добавляем колонку locale
    console.log('📋 Step 2: Adding locale column...');
    await db.execute(`
      ALTER TABLE navi."seo-stats" 
      ADD COLUMN locale VARCHAR(10) DEFAULT 'uk'
    `);
    console.log('✅ Column locale added');

    // 3. Обновляем существующие записи
    console.log('📋 Step 3: Setting locale for existing records...');
    const updateResult = await db.execute(`
      UPDATE navi."seo-stats" 
      SET locale = 'uk' 
      WHERE locale IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount || 0} existing records with locale='uk'`);

    // 4. Делаем колонку NOT NULL
    console.log('📋 Step 4: Making locale NOT NULL...');
    await db.execute(`
      ALTER TABLE navi."seo-stats" 
      ALTER COLUMN locale SET NOT NULL
    `);
    console.log('✅ Column locale is now NOT NULL');

    // 5. Удаляем старый индекс (если есть)
    console.log('📋 Step 5: Removing old index (if exists)...');
    try {
      await db.execute(`
        DROP INDEX IF EXISTS navi.idx_seo_stats_entity
      `);
      console.log('✅ Old index removed');
    } catch (e) {
      console.log('ℹ️  Old index not found, skipping');
    }

    // 6. Создаём новый уникальный индекс с locale
    console.log('📋 Step 6: Creating new unique index...');
    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_stats_entity_locale 
      ON navi."seo-stats" (entity_type, entity_id, locale)
    `);
    console.log('✅ Unique index created: (entity_type, entity_id, locale)');

    // 7. Проверяем структуру таблицы
    console.log('📋 Step 7: Verifying table structure...');
    const structure = await db.execute(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'navi' 
        AND table_name = 'seo-stats'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Final table structure:');
    console.table(structure.rows);

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n✅ What was done:');
    console.log('  1. Added locale column (VARCHAR(10), NOT NULL, default: uk)');
    console.log('  2. Set locale=uk for all existing records');
    console.log('  3. Created unique index on (entity_type, entity_id, locale)');
    console.log('\n💡 Now you can have separate SEO data for each locale (ru, ua, en)');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n📋 Error details:');
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
    process.exit(1);
  }
}

// Запускаем миграцию
migrate();
