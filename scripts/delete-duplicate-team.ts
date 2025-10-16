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
  const payload = await getPayload({ config });

  console.log('Deleting duplicate team member record (id: 7, slug: andrii-gov)...');

  try {
    await payload.delete({
      collection: 'team-new',
      id: 7,
    });

    console.log('Successfully deleted duplicate record');
  } catch (error) {
    console.error('Error deleting record:', error);
  }

  await payload.close?.();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
