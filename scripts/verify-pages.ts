#!/usr/bin/env tsx
/** Verify Pages draft data is accessible via Local API for all locales. */
import 'dotenv/config';
import payload from 'payload';
import payloadConfig from '../src/payload.config';

async function main() {
  await payload.init({ config: payloadConfig });

  const { docs } = await payload.find({
    collection: 'pages',
    limit: 0,
    pagination: false,
    overrideAccess: true,
    draft: true,
  });

  console.log(`Found ${docs.length} pages\n`);

  for (const page of docs) {
    console.log(`pageKey=${page.pageKey} pageType=${page.pageType} _status=${page._status}`);
    for (const locale of ['ru', 'uk', 'en'] as const) {
      const localized = await payload.findByID({
        collection: 'pages',
        id: page.id,
        locale,
        overrideAccess: true,
        draft: true,
      });
      const h1 = (localized as any).h1 || '(empty)';
      const seoTitle = (localized as any).seo?.title || '(empty)';
      console.log(`  ${locale}: h1="${h1.slice(0, 50)}" title="${seoTitle.slice(0, 50)}"`);
    }
    console.log();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
