#!/usr/bin/env tsx

import 'dotenv/config';
import { getPayload } from 'payload';
import { generateSlug } from '../src/utils/slug';
import config from '../src/payload.config';

// Workaround для undici проблемы в Payload v3
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('CacheStorage')) return;
  originalWarn(...args);
};

async function main() {
  const payload = await getPayload({ config });

  console.log('Regenerating team slugs based on English names...');

  // Получить все записи команды
  const result = await payload.find({
    collection: 'team-new',
    limit: 100,
  });

  for (const member of result.docs) {
    // Получить английское имя
    const englishName = member.name?.en || member.name?.uk || member.name?.ru;

    if (!englishName) {
      console.log(`Skipping ${member.slug} - no English name found`);
      continue;
    }

    // Генерировать новый slug на основе английского имени
    const newSlug = generateSlug(englishName);

    if (newSlug !== member.slug) {
      console.log(`Updating slug for ${member.slug}: "${member.slug}" -> "${newSlug}" (from "${englishName}")`);

      // Обновить slug
      await payload.update({
        collection: 'team-new',
        id: member.id,
        data: {
          slug: newSlug,
        },
      });

      console.log(`✅ Updated slug: ${member.slug} -> ${newSlug}`);
    } else {
      console.log(`✅ Slug already correct: ${member.slug}`);
    }
  }

  console.log('Slug regeneration completed');

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
