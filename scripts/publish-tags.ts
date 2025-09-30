#!/usr/bin/env tsx

import 'dotenv/config';

import payload from 'payload';

import payloadConfig from '../src/payload.config';

async function main() {
  await payload.init({ config: payloadConfig });

  const { docs } = await payload.find({
    collection: 'tags',
    limit: 0,
    pagination: false,
    overrideAccess: true,
    where: {
      _status: {
        equals: 'draft',
      },
    },
  });

  let updated = 0;

  for (const doc of docs) {
    await payload.update({
      collection: 'tags',
      id: doc.id,
      data: {
        _status: 'published',
      },
      overrideAccess: true,
      draft: false,
    });
    updated += 1;
  }

  console.log(`Published ${updated} draft tag(s).`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
