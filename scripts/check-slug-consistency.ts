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

  console.log('Checking team slug/name consistency...');

  // Получить все записи команды
  const result = await payload.find({
    collection: 'team-new',
    limit: 10,
  });

  for (const member of result.docs) {
    console.log(`\n--- Team Member ID: ${member.id} ---`);
    console.log(`Current slug: "${member.slug}"`);
    console.log(`Names:`);

    if (member.name) {
      if (typeof member.name === 'string') {
        console.log(`  RU: "${member.name}"`);
      } else if (typeof member.name === 'object') {
        for (const [locale, name] of Object.entries(member.name)) {
          console.log(`  ${locale.toUpperCase()}: "${name}"`);
        }
      }
    } else {
      console.log('  No names found');
    }

    // Проверить соответствие slug'а русскому имени
    const russianName = member.name?.ru || member.name;
    if (russianName && member.slug) {
      const expectedSlug = russianName
        .toLowerCase()
        .replace(/а/g, 'a').replace(/б/g, 'b').replace(/в/g, 'v').replace(/г/g, 'g')
        .replace(/д/g, 'd').replace(/е/g, 'e').replace(/ё/g, 'yo').replace(/ж/g, 'zh')
        .replace(/з/g, 'z').replace(/и/g, 'i').replace(/й/g, 'y').replace(/к/g, 'k')
        .replace(/л/g, 'l').replace(/м/g, 'm').replace(/н/g, 'n').replace(/о/g, 'o')
        .replace(/п/g, 'p').replace(/р/g, 'r').replace(/с/g, 's').replace(/т/g, 't')
        .replace(/у/g, 'u').replace(/ф/g, 'f').replace(/х/g, 'h').replace(/ц/g, 'ts')
        .replace(/ч/g, 'ch').replace(/ш/g, 'sh').replace(/щ/g, 'shch').replace(/ъ/g, '')
        .replace(/ы/g, 'y').replace(/ь/g, '').replace(/э/g, 'e').replace(/ю/g, 'yu')
        .replace(/я/g, 'ya')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);

      if (member.slug !== expectedSlug) {
        console.log(`❌ SLUG MISMATCH:`);
        console.log(`  Expected: "${expectedSlug}"`);
        console.log(`  Actual: "${member.slug}"`);
      } else {
        console.log(`✅ Slug matches Russian name`);
      }
    }
  }

  console.log('\nSlug consistency check completed');

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
