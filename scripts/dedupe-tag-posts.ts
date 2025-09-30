#!/usr/bin/env tsx

import 'dotenv/config';

import payload from 'payload';

import payloadConfig from '../src/payload.config';

function dedupeRelationField<T>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (item === null || item === undefined) {
      continue;
    }

    let key: string;

    if (typeof item === 'object') {
      const maybeRelation = item as { relationTo?: string; value?: unknown; id?: unknown };
      const identifier = maybeRelation.value ?? maybeRelation.id ?? JSON.stringify(item);
      key = `${maybeRelation.relationTo ?? ''}:${String(identifier)}`;
    } else {
      key = String(item);
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

async function main() {
  await payload.init({ config: payloadConfig });

  const { docs } = await payload.find({
    collection: 'tags',
    limit: 0,
    pagination: false,
    overrideAccess: true,
  });

  let touched = 0;

  for (const doc of docs) {
    const posts = Array.isArray(doc.posts) ? dedupeRelationField(doc.posts) : doc.posts;
    const faqs = Array.isArray(doc.faqs) ? dedupeRelationField(doc.faqs) : doc.faqs;

    const postsChanged = Array.isArray(doc.posts) && posts.length !== doc.posts.length;
    const faqsChanged = Array.isArray(doc.faqs) && faqs.length !== doc.faqs.length;

    if (!postsChanged && !faqsChanged) {
      continue;
    }

    await payload.update({
      collection: 'tags',
      id: doc.id,
      data: {
        posts,
        faqs,
      },
      overrideAccess: true,
      draft: false,
    });

    touched += 1;
  }

  console.log(`Updated ${touched} tag(s) with deduplicated relations.`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
