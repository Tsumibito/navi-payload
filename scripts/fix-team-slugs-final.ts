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

  console.log('Fixing team slugs based on English names...');

  // Получить все записи команды
  const result = await payload.find({
    collection: 'team-new',
    limit: 10,
  });

  for (const member of result.docs) {
    console.log(`\n--- Member ${member.id} ---`);
    console.log('Current slug:', member.slug);
    console.log('Names:', JSON.stringify(member.name, null, 2));

    // Определяем лучшее имя для slug
    let sourceName = null;
    let sourceLocale = null;

    if (member.name?.en) {
      sourceName = member.name.en;
      sourceLocale = 'en';
    } else if (member.name?.uk) {
      sourceName = member.name.uk;
      sourceLocale = 'uk';
    } else if (member.name?.ru) {
      sourceName = member.name.ru;
      sourceLocale = 'ru';
    }

    if (sourceName) {
      const newSlug = sourceName
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

      if (newSlug !== member.slug && newSlug.length > 0) {
        console.log(`Updating slug: "${member.slug}" -> "${newSlug}" (from ${sourceLocale} name)`);

        await payload.update({
          collection: 'team-new',
          id: member.id,
          data: { slug: newSlug },
        });

        console.log('✅ Updated');
      } else {
        console.log('✅ Already correct');
      }
    } else {
      console.log('❌ No name found for slug generation');
    }
  }

  console.log('\nSlug fix completed');
  await payload.close();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
