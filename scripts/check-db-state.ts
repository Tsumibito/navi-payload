import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URI,
});

async function main() {
  console.log('🔍 Проверка состояния БД\n');
  
  // Проверяем основные таблицы коллекций
  const collections = [
    'users',
    'media', 
    'posts',
    'tags',
    'tags_new',
    'team',
    'faqs',
    'certificates',
    'trainings',
    'redirects',
  ];
  
  console.log('📋 Таблицы коллекций:\n');
  
  for (const table of collections) {
    const res = await pool.query(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = $1;`,
      [table],
    );
    
    if (res.rowCount === 0) {
      console.log(`❌ ${table} - не найдена`);
    } else {
      const schema = res.rows[0].table_schema;
      
      // Считаем записи
      const countRes = await pool.query(
        `SELECT COUNT(*) as count FROM ${schema}.${table};`
      );
      const count = countRes.rows[0].count;
      
      console.log(`✅ ${schema}.${table} - ${count} записей`);
    }
  }
  
  // Проверяем таблицы локализации
  console.log('\n🌍 Таблицы локализации:\n');
  
  const localesTables = [
    'tags_locales',
    'tags_new_locales',
    'posts_locales',
    'team_locales',
  ];
  
  for (const table of localesTables) {
    const res = await pool.query(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = $1;`,
      [table],
    );
    
    if (res.rowCount === 0) {
      console.log(`❌ ${table} - не найдена`);
    } else {
      const schema = res.rows[0].table_schema;
      const countRes = await pool.query(
        `SELECT COUNT(*) as count FROM ${schema}.${table};`
      );
      const count = countRes.rows[0].count;
      console.log(`✅ ${schema}.${table} - ${count} записей`);
    }
  }
  
  // Проверяем таблицы translations (старая схема)
  console.log('\n📝 Таблицы переводов (старая схема):\n');
  
  const translationsTables = [
    'tags_translations',
    'posts_translations',
    'team_translations',
  ];
  
  for (const table of translationsTables) {
    const res = await pool.query(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = $1;`,
      [table],
    );
    
    if (res.rowCount === 0) {
      console.log(`❌ ${table} - не найдена`);
    } else {
      const schema = res.rows[0].table_schema;
      const countRes = await pool.query(
        `SELECT COUNT(*) as count FROM ${schema}.${table};`
      );
      const count = countRes.rows[0].count;
      console.log(`✅ ${schema}.${table} - ${count} записей`);
    }
  }
  
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Ошибка:', err);
  process.exit(1);
});
