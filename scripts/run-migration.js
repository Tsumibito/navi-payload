/**
 * Скрипт для выполнения SQL миграции
 * Запуск: node scripts/run-migration.js
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URI
});

if (!process.env.DATABASE_URI) {
  console.error('❌ Ошибка: DATABASE_URI не найден в .env файле');
  process.exit(1);
}

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Подключение к БД...');
    
    const sqlPath = path.resolve(__dirname, '../migrations/add-seo-cache-fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📝 Выполнение миграции...');
    await client.query(sql);
    
    console.log('✅ Миграция успешно выполнена!');
    console.log('');
    console.log('Добавлены колонки:');
    console.log('  - seo_focus_keyphrase_stats (jsonb)');
    console.log('  - seo_additional_fields (jsonb)');
    console.log('');
    console.log('В таблицы:');
    console.log('  - posts_new + posts_new_locales');
    console.log('  - tags_new + tags_new_locales');
    console.log('  - team_new + team_new_locales');
    console.log('  - certificates (без локализации)');
    console.log('  - trainings (без локализации)');
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
