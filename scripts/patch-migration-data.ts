#!/usr/bin/env tsx

/* eslint-disable @typescript-eslint/no-explicit-any */

import 'dotenv/config';
import payload from 'payload';
import payloadConfig from '../src/payload.config';

const EMPTY_LEXICAL = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'text',
            text: '',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
      },
    ],
  },
};

const initPayload = async () => {
  await payload.init({
    config: payloadConfig as any,
    local: true,
  } as any);
  return payload as any;
};

const patchTeamBioSummary = async (payloadClient: any) => {
  console.log('\n=== Patching Team bioSummary ===');
  
  const team = await payloadClient.find({
    collection: 'team',
    limit: 1000,
  });

  let fixed = 0;
  for (const member of team.docs) {
    if (typeof member.bioSummary === 'string') {
      await payloadClient.update({
        collection: 'team',
        id: member.id,
        data: {
          bioSummary: EMPTY_LEXICAL,
        },
      });
      console.log(`Fixed bioSummary for team member: ${member.name}`);
      fixed++;
    }
  }

  console.log(`Team bioSummary patched: ${fixed} members`);
};

const patchTeamLinks = async (payloadClient: any) => {
  console.log('\n=== Patching Team links ===');
  
  const team = await payloadClient.find({
    collection: 'team',
    limit: 1000,
  });

  for (const member of team.docs) {
    if (member.links && Array.isArray(member.links) && member.links.length > 0) {
      const hasValidLinks = member.links.some((link: any) => link.service && link.url);
      if (!hasValidLinks) {
        console.log(`Team member ${member.name} has invalid links structure - checking field names`);
        // Проверяем, может быть поле называется 'link' вместо 'url'
        const needsRemap = member.links.some((link: any) => link.link && !link.url);
        if (needsRemap) {
          const remappedLinks = member.links.map((link: any) => ({
            service: link.service,
            url: link.link || link.url,
          }));
          await payloadClient.update({
            collection: 'team',
            id: member.id,
            data: { links: remappedLinks },
          });
          console.log(`Remapped links for ${member.name}`);
        }
      } else {
        console.log(`Team member ${member.name} links OK: ${member.links.length} links`);
      }
    } else {
      console.log(`Team member ${member.name} has no links`);
    }
  }

  console.log(`Team links checked`);
};

const patchCertificatesDescription = async (payloadClient: any) => {
  console.log('\n=== Patching Certificates description ===');
  
  const certificates = await payloadClient.find({
    collection: 'certificates',
    limit: 1000,
  });

  let fixed = 0;
  for (const cert of certificates.docs) {
    let needsUpdate = false;
    const updates: any = {};

    if (!cert.description || (typeof cert.description === 'object' && !cert.description.root)) {
      updates.description = EMPTY_LEXICAL;
      needsUpdate = true;
    }

    if (cert.translations && Array.isArray(cert.translations)) {
      const fixedTranslations = cert.translations.map((tr: any) => {
        if (!tr.description || (typeof tr.description === 'object' && !tr.description.root)) {
          return { ...tr, description: EMPTY_LEXICAL };
        }
        return tr;
      });
      updates.translations = fixedTranslations;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await payloadClient.update({
        collection: 'certificates',
        id: cert.id,
        data: updates,
      });
      console.log(`Fixed description for certificate: ${cert.title}`);
      fixed++;
    }
  }

  console.log(`Certificates description patched: ${fixed} certificates`);
};

const patchTagsPostsRelations = async (payloadClient: any) => {
  console.log('\n=== Patching Tags posts relations ===');
  
  // Получаем все посты с тегами
  const posts = await payloadClient.find({
    collection: 'posts',
    limit: 1000,
  });

  // Собираем обратные связи tag -> posts
  const tagToPosts = new Map<number, number[]>();
  
  for (const post of posts.docs) {
    if (post.tags && Array.isArray(post.tags)) {
      for (const tag of post.tags) {
        const tagId = typeof tag === 'object' ? tag.value : tag;
        const numericTagId = typeof tagId === 'string' ? parseInt(tagId, 10) : tagId;
        const numericPostId = typeof post.id === 'string' ? parseInt(post.id, 10) : post.id;
        
        if (!tagToPosts.has(numericTagId)) {
          tagToPosts.set(numericTagId, []);
        }
        tagToPosts.get(numericTagId)!.push(numericPostId);
      }
    }
  }

  console.log(`Found ${tagToPosts.size} tags with posts`);

  // Обновляем теги через прямой SQL
  let updated = 0;
  const db = payloadClient.db;
  
  for (const [tagId, postIds] of tagToPosts) {
    try {
      // Удаляем старые связи
      await db.execute(`DELETE FROM tags_rels WHERE parent_id = ${tagId} AND path = 'posts'`);
      
      // Добавляем новые связи
      for (let i = 0; i < postIds.length; i++) {
        await db.execute(`
          INSERT INTO tags_rels (parent_id, "order", path, posts_id)
          VALUES (${tagId}, ${i + 1}, 'posts', ${postIds[i]})
        `);
      }
      
      console.log(`Updated tag ${tagId} with ${postIds.length} posts`);
      updated++;
    } catch (error) {
      console.error(`Failed to update tag ${tagId}:`, (error as Error).message);
    }
  }

  console.log(`Tags posts relations patched: ${updated} tags updated`);
};

const main = async () => {
  console.log('Starting migration data patch...');
  
  const payloadClient = await initPayload();

  await patchTeamBioSummary(payloadClient);
  await patchTeamLinks(payloadClient);
  await patchCertificatesDescription(payloadClient);
  await patchTagsPostsRelations(payloadClient);

  console.log('\n✅ Migration data patch completed!');
  process.exit(0);
};

main().catch((error) => {
  console.error('Patch failed:', error);
  process.exit(1);
});
