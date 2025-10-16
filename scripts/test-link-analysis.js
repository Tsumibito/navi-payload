#!/usr/bin/env node
/**
 * Тестовый скрипт для проверки алгоритма анализа ссылок
 */

import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URI,
});

async function testLinkAnalysis() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Получаем пост с keywords
    const postsResult = await client.query(`
      SELECT id, seo_link_keywords 
      FROM navi.posts_new 
      WHERE seo_link_keywords IS NOT NULL 
      LIMIT 3
    `);

    console.log(`Found ${postsResult.rows.length} posts with link_keywords\n`);

    for (const post of postsResult.rows) {
      console.log(`\n=== POST ID: ${post.id} ===`);
      
      if (post.seo_link_keywords && post.seo_link_keywords.keywords) {
        const keywords = post.seo_link_keywords.keywords;
        console.log(`Keywords count: ${keywords.length}`);
        
        for (const kw of keywords.slice(0, 3)) {
          console.log(`\nKeyword: "${kw.keyword}"`);
          console.log(`  Links: ${kw.linksCount || 0}`);
          console.log(`  Potential: ${kw.potentialLinksCount || 0}`);
          console.log(`  Total occurrences: ${kw.cachedTotal || 0}`);
          console.log(`  In headings: ${kw.cachedHeadings || 0}`);
        }
      }
    }

    // Проверяем контент других постов на наличие ссылок
    console.log('\n\n=== Checking for links in content ===\n');
    
    const contentResult = await client.query(`
      SELECT id, content 
      FROM navi.posts_new 
      WHERE content IS NOT NULL 
      LIMIT 5
    `);

    for (const post of contentResult.rows) {
      if (post.content && post.content.root && post.content.root.children) {
        console.log(`\nPost ${post.id}:`);
        const linksFound = findLinksInContent(post.content);
        console.log(`  Found ${linksFound.length} links`);
        
        for (const link of linksFound.slice(0, 3)) {
          console.log(`    - "${link.text}" -> ${link.url || link.type}`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

function findLinksInContent(content, links = []) {
  if (!content) return links;

  function traverse(node) {
    if (node.type === 'link' || node.type === 'autolink') {
      const text = extractText(node);
      links.push({
        type: node.type,
        url: node.url,
        text: text,
      });
    }

    if (node.fields?.doc) {
      const text = extractText(node);
      links.push({
        type: 'internal',
        relationTo: node.fields.doc.relationTo,
        docId: node.fields.doc.value,
        text: text,
      });
    }

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }

  if (content.root && content.root.children) {
    content.root.children.forEach(traverse);
  }

  return links;
}

function extractText(node) {
  if (node.text) return node.text;
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(extractText).join('');
  }
  return '';
}

testLinkAnalysis();
