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

  console.log('Establishing authorship links between team members and posts...');

  // Получить все посты с информацией об авторах
  const postsResult = await payload.find({
    collection: 'posts-new',
    limit: 1000,
  });

  console.log(`Found ${postsResult.docs.length} posts`);

  // Группировать посты по авторам
  const postsByAuthor = new Map();

  for (const post of postsResult.docs) {
    const authorId = post.author;

    if (authorId) {
      if (!postsByAuthor.has(authorId)) {
        postsByAuthor.set(authorId, []);
      }
      postsByAuthor.get(authorId).push(post.id);
    }
  }

  console.log(`Found ${postsByAuthor.size} authors with posts`);

  // Обновить каждую запись команды
  for (const [authorId, postIds] of postsByAuthor.entries()) {
    try {
      // Получить текущие посты команды
      const teamMember = await payload.findByID({
        collection: 'team-new',
        id: authorId,
      });

      const currentPostIds = teamMember.posts || [];
      const currentPostIdStrings = currentPostIds.map(p => typeof p === 'object' ? p.id : p);

      // Проверить, какие посты нужно добавить
      const newPostIds = postIds.filter(postId => !currentPostIdStrings.includes(postId));

      if (newPostIds.length > 0) {
        console.log(`Adding ${newPostIds.length} posts to team member ${authorId}`);

        // Обновить поле posts
        await payload.update({
          collection: 'team-new',
          id: authorId,
          data: {
            posts: [...currentPostIds, ...newPostIds],
          },
        });

        console.log(`✅ Updated team member ${authorId} with ${newPostIds.length} new posts`);
      } else {
        console.log(`✅ Team member ${authorId} already has all posts`);
      }
    } catch (error) {
      console.error(`❌ Failed to update team member ${authorId}:`, error);
    }
  }

  console.log('Authorship links establishment completed');

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
