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

  console.log('Regenerating localized team slugs based on names in each language...');

  // Получить все записи команды со всеми локализациями
  const result = await payload.find({
    collection: 'team-new',
    limit: 100,
    locale: 'all',
  });

  for (const member of result.docs) {
    const locales = ['ru', 'uk', 'en'];

    for (const locale of locales) {
      // Получить имя для текущей локали
      const nameForLocale = member.name?.[locale];

      if (!nameForLocale) {
        console.log(`Skipping ${member.slug} for locale ${locale} - no name found`);
        continue;
      }

      // Генерировать slug на основе имени в текущей локали
      const newSlug = generateSlug(nameForLocale);

      // Получить текущий slug для этой локали
      const currentSlug = member.slug?.[locale];

      if (newSlug !== currentSlug) {
        console.log(`Updating slug for ${nameForLocale} (${locale}): "${currentSlug}" -> "${newSlug}"`);

        // Обновить slug для конкретной локали
        await payload.update({
          collection: 'team-new',
          id: member.id,
          locale: locale,
          data: {
            slug: newSlug,
          },
        });

        console.log(`✅ Updated slug for locale ${locale}: ${newSlug}`);
      } else {
        console.log(`✅ Slug already correct for locale ${locale}: ${currentSlug}`);
      }
    }
  }

  console.log('Localized slug regeneration completed');

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
