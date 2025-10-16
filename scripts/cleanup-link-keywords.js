#!/usr/bin/env node
/**
 * Скрипт очистки link_keywords от лишних символов (фигурные скобки, кавычки)
 * 
 * Использование:
 *   node scripts/cleanup-link-keywords.js
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

function cleanKeyword(keyword) {
  if (!keyword || typeof keyword !== 'string') return '';
  
  return keyword
    .replace(/^\{+/g, '')            // Убираем все { в начале
    .replace(/\}+$/g, '')            // Убираем все } в конце  
    .replace(/\\+"/g, '"')           // Заменяем любое количество \ перед " на просто "
    .replace(/^["'`]+/g, '')         // Убираем кавычки в начале (все типы)
    .replace(/["'`]+$/g, '')         // Убираем кавычки в конце
    .replace(/^\[+/g, '')            // Убираем [ в начале
    .replace(/\]+$/g, '')            // Убираем ] в конце
    .trim();
}

async function cleanupLinkKeywords() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Получаем все записи с link_keywords
    const result = await client.query(
      `SELECT id, entity_type, entity_id, link_keywords 
       FROM navi."seo-stats" 
       WHERE link_keywords IS NOT NULL`
    );

    console.log(`Found ${result.rows.length} records with link_keywords`);

    let updated = 0;
    let skipped = 0;

    for (const row of result.rows) {
      const { id, link_keywords } = row;

      if (!link_keywords || !link_keywords.keywords || link_keywords.keywords.length === 0) {
        skipped++;
        continue;
      }

      // Очищаем keywords
      const cleanedKeywords = link_keywords.keywords.map((entry) => ({
        ...entry,
        keyword: cleanKeyword(entry.keyword),
      }));

      // Проверяем, изменились ли данные
      const hasChanges = cleanedKeywords.some((cleaned, index) => {
        return cleaned.keyword !== link_keywords.keywords[index].keyword;
      });

      if (!hasChanges) {
        skipped++;
        continue;
      }

      // Обновляем запись
      const updatedLinkKeywords = {
        ...link_keywords,
        keywords: cleanedKeywords,
      };

      await client.query(
        `UPDATE navi."seo-stats" 
         SET link_keywords = $1, updated_at = NOW() 
         WHERE id = $2`,
        [JSON.stringify(updatedLinkKeywords), id]
      );

      updated++;
      console.log(`✓ Updated record ${id}:`);
      console.log(`  Before: ${link_keywords.keywords.slice(0, 2).map(k => k.keyword).join(', ')}`);
      console.log(`  After:  ${cleanedKeywords.slice(0, 2).map(k => k.keyword).join(', ')}`);
    }

    console.log('\n=== Summary ===');
    console.log(`Total records: ${result.rows.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

cleanupLinkKeywords();
