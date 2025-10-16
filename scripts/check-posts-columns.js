const { Client } = require('pg');
require('dotenv').config();

async function checkColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'navi' 
        AND table_name = 'posts_new'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in posts_new:');
    console.table(result.rows);
    
    // Также покажем пример данных
    const sample = await client.query(`
      SELECT id, slug 
      FROM navi.posts_new 
      LIMIT 3
    `);
    
    console.log('\nSample data:');
    console.table(sample.rows);
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    try {
      await client.end();
    } catch (e) {}
  }
}

checkColumns();
