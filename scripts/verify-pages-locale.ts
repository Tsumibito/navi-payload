#!/usr/bin/env tsx
/** Verify Pages with locale=uk, fallbackLocale=false returns only real uk data. */
import 'dotenv/config';
import payload from 'payload';
import payloadConfig from '../src/payload.config';

const EXPECTED = {
  home: { ru: true, en: true, uk: true },
  blog: { ru: true, en: true, uk: true },
  tags: { ru: true, en: true, uk: true },
  charter: { ru: true, en: true, uk: true },
  'sailing-school': { ru: true, en: true, uk: true },
  'charter-for-dummies': { ru: true, en: false, uk: true },
  'yahting-dlya-vseh': { ru: true, en: false, uk: false },
  'payment-issue': { ru: false, en: false, uk: true },
};

async function main() {
  await payload.init({ config: payloadConfig });

  const { docs } = await payload.find({
    collection: 'pages',
    limit: 0,
    pagination: false,
    overrideAccess: true,
    draft: true,
  });

  let ok = 0;
  let fail = 0;

  for (const page of docs) {
    const expected = EXPECTED[page.pageKey as keyof typeof EXPECTED];
    if (!expected) continue;

    for (const locale of ['ru', 'uk', 'en'] as const) {
      const localized = await payload.findByID({
        collection: 'pages',
        id: page.id,
        locale,
        fallbackLocale: false as any,
        overrideAccess: true,
        draft: true,
      });
      const hasData = !!(localized as any).h1;
      const expectedHasData = expected[locale];
      const match = hasData === expectedHasData;
      if (match) {
        ok += 1;
      } else {
        fail += 1;
        console.log(`MISMATCH: ${page.pageKey}/${locale} hasData=${hasData} expected=${expectedHasData}`);
      }
    }
  }

  console.log(`\nLocale presence check: ${ok} ok, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
