import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URI,
});

async function main() {
  const tables = ['users_sessions', 'tags_new', 'tags_new_locales'];
  for (const table of tables) {
    const res = await pool.query(
      `SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = $1;`,
      [table],
    );
    if (res.rowCount === 0) {
      console.log(`❌ Table ${table} not found`);
    } else {
      res.rows.forEach((row) => console.log(`✅ ${row.table_schema}.${row.table_name}`));
    }
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
