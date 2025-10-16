/**
 * СРОЧНАЯ МИГРАЦИЯ: Добавление колонки locale в seo-stats
 * Запуск: node scripts/add-locale-column.js
 */

const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
  console.log('🚀 Starting migration: add locale column to seo-stats\n');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Проверяем существование колонки
    console.log('📋 Step 1: Checking if locale column exists...');
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'navi' 
        AND table_name = 'seo-stats' 
        AND column_name = 'locale'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column locale already exists. Migration not needed.\n');
      await client.end();
      process.exit(0);
    }
    console.log('ℹ️  Column locale does not exist. Proceeding...\n');

    // 2. Добавляем колонку
    console.log('📋 Step 2: Adding locale column...');
    await client.query(`
      ALTER TABLE navi."seo-stats" 
      ADD COLUMN locale VARCHAR(10) DEFAULT 'uk'
    `);
    console.log('✅ Column added\n');

    // 3. Обновляем существующие записи
    console.log('📋 Step 3: Setting locale=uk for existing records...');
    const updateResult = await client.query(`
      UPDATE navi."seo-stats" 
      SET locale = 'uk' 
      WHERE locale IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} records\n`);

    // 4. Делаем NOT NULL
    console.log('📋 Step 4: Making locale NOT NULL...');
    await client.query(`
      ALTER TABLE navi."seo-stats" 
      ALTER COLUMN locale SET NOT NULL
    `);
    console.log('✅ Column is now NOT NULL\n');

    // 5. Удаляем старый индекс
    console.log('📋 Step 5: Removing old unique constraint...');
    try {
      // Сначала находим имя constraint
      const constraintResult = await client.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = 'navi'
          AND table_name = 'seo-stats'
          AND constraint_type = 'UNIQUE'
      `);
      
      for (const row of constraintResult.rows) {
        console.log(`  Dropping constraint: ${row.constraint_name}`);
        await client.query(`
          ALTER TABLE navi."seo-stats" 
          DROP CONSTRAINT IF EXISTS "${row.constraint_name}"
        `);
      }
      console.log('✅ Old constraints removed\n');
    } catch (e) {
      console.log('ℹ️  No old constraints found\n');
    }

    // 6. Создаём новый уникальный constraint
    console.log('📋 Step 6: Creating new unique constraint...');
    await client.query(`
      ALTER TABLE navi."seo-stats"
      ADD CONSTRAINT seo_stats_entity_locale_unique 
      UNIQUE (entity_type, entity_id, locale)
    `);
    console.log('✅ Unique constraint created: (entity_type, entity_id, locale)\n');

    // 7. Проверяем финальную структуру
    console.log('📋 Step 7: Verifying table structure...');
    const structure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'navi' 
        AND table_name = 'seo-stats'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Table structure:');
    console.table(structure.rows);

    console.log('\n🎉 Migration completed successfully!\n');
    console.log('✅ What was done:');
    console.log('  1. Added locale column (VARCHAR(10), NOT NULL, default: uk)');
    console.log('  2. Set locale=uk for all existing records');
    console.log('  3. Created unique constraint on (entity_type, entity_id, locale)');
    console.log('\n💡 Now you can have separate SEO data for each locale!\n');

    await client.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    
    try {
      await client.end();
    } catch (e) {
      // ignore
    }
    
    process.exit(1);
  }
}

// Запуск
migrate();
