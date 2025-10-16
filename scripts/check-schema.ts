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
  console.log('Starting database migration for team-new collection...');

  const payload = await getPayload({ config });

  try {
    // Попробуем выполнить простую операцию для инициализации схемы
    const result = await payload.find({
      collection: 'team-new',
      limit: 1,
    });

    console.log('Schema appears to be initialized correctly');
    console.log(`Found ${result.docs.length} documents`);
  } catch (error) {
    console.error('Error accessing team-new collection:', error);

    if (error.message?.includes('column "id" of relation "team_new_rels" does not exist')) {
      console.log('This suggests a schema mismatch. Try running Payload migrations or check if the collection schema is properly configured.');
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
    console.error('Migration failed:', error);
    process.exit(1);
  });
