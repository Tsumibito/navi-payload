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

  console.log('Checking team data structure...');

  // Получить одну запись команды для анализа структуры
  const result = await payload.find({
    collection: 'team-new',
    limit: 1,
  });

  if (result.docs.length === 0) {
    console.log('No team members found');
    await payload.close?.();
    return;
  }

  const member = result.docs[0];
  console.log('Team member structure:');
  console.log(JSON.stringify(member, null, 2));

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
