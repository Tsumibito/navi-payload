#!/usr/bin/env tsx

import 'dotenv/config';

import { getPayload } from 'payload';

import payloadConfig from '../src/payload.config';

async function main() {
  const payload = await getPayload({ config: payloadConfig });

  const posts = await payload.find({
    collection: 'posts-new',
    limit: 500,
    locale: 'all',
  });

  const summary = posts.docs.map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.name,
    author: doc.author,
  }));

  console.log(JSON.stringify({ total: posts.totalDocs, posts: summary }, null, 2));

  await payload.close?.();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
