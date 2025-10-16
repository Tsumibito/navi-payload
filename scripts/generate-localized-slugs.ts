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

// Функция для генерации slug из имени
function generateSlugFromName(name: string): string {
  return name
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
}

async function main() {
  const payload = await getPayload({ config });

  console.log('Generating localized team slugs based on names in each language...');

  // Получить все записи команды со всеми локализациями
  const result = await payload.find({
    collection: 'team-new',
    limit: 10,
    locale: 'all',
  });

  for (const member of result.docs) {
    const locales = ['ru', 'uk', 'en'];

    for (const locale of locales) {
      const nameForLocale = member.name?.[locale];

      if (!nameForLocale) {
        console.log(`No name found for locale ${locale} for member ${member.id}`);
        continue;
      }

      const currentSlug = member.slug?.[locale];
      const newSlug = generateSlugFromName(nameForLocale);

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

  console.log('Localized slug generation completed');

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
