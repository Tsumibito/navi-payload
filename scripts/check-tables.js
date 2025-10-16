const { Client } = require('pg');
require('dotenv').config();

async function checkTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URI,
  });

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'navi' 
        AND table_name LIKE '%post%'
      ORDER BY table_name
    `);
    
    console.log('Tables with "post" in name:');
    console.table(result.rows);
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    try {
      await client.end();
    } catch (e) {}
  }
}

checkTables();
