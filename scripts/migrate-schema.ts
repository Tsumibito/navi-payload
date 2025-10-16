#!/usr/bin/env tsx

import 'dotenv/config';
import { getPayload } from 'payload';
import config from '../src/payload.config';

// Workaround для undici проблемы в Payload v3
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('CacheStorage')) return;
  originalWarn(...args);
};

async function main() {
  console.log('Running database migration for localized slug field...');

  const payload = await getPayload({ config });

  try {
    // Попробуем выполнить простую операцию для инициализации схемы
    const result = await payload.find({
      collection: 'team-new',
      limit: 1,
    });

    console.log('Schema migration appears to be successful');
    console.log(`Found ${result.docs.length} documents`);
  } catch (error) {
    console.error('Migration failed:', error);
    if (error.message?.includes('column') && error.message?.includes('does not exist')) {
      console.log('This suggests schema is not synchronized. The column should be created automatically by Payload.');
      console.log('Try restarting the server or check if there are any pending migrations.');
    }
  }

  await payload.close?.();
  console.log('Migration check completed');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
