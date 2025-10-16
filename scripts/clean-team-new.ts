#!/usr/bin/env tsx

import { getPayload } from 'payload';
import config from '../src/payload.config';

async function main() {
  const payload = await getPayload({ config });

  console.log('Fetching all team-new documents...');

  // Получить все документы
  const result = await payload.find({
    collection: 'team-new',
    limit: 1000,
  });

  console.log(`Found ${result.docs.length} team members to delete`);

  if (result.docs.length === 0) {
    console.log('No documents to delete');
    await payload.close?.();
    return;
  }

  // Удалить все документы
  for (const doc of result.docs) {
    await payload.delete({
      collection: 'team-new',
      id: doc.id,
    });
    console.log(`Deleted team member: ${doc.name?.ru || doc.slug || doc.id}`);
  }

  console.log(`Successfully deleted ${result.docs.length} team members`);

  await payload.close?.();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
