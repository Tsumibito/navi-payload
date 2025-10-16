#!/usr/bin/env node
/**
 * Скрипт для очистки seo_link_keywords в локализованных таблицах
 * Очищает от лишних символов типа {", \", [, ] и т.д.
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

async function cleanupLocalesLinkKeywords() {
  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    const tables = [
      'posts_new_locales',
      'tags_new_locales',
      'team_new_locales',
      'certificates_new_locales',
      'trainings_locales',
    ];

    let totalUpdated = 0;

    for (const table of tables) {
      console.log(`\n=== Processing ${table} ===`);
      
      try {
        // Проверяем существование таблицы
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'navi' AND table_name = $1
          )
        `, [table]);

        if (!tableCheck.rows[0].exists) {
          console.log(`⊘ Table navi.${table} does not exist, skipping`);
          continue;
        }

        // Проверяем существование колонки seo_link_keywords
        const columnCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'navi' 
              AND table_name = $1 
              AND column_name = 'seo_link_keywords'
          )
        `, [table]);

        if (!columnCheck.rows[0].exists) {
          console.log(`⊘ Column seo_link_keywords does not exist in ${table}, skipping`);
          continue;
        }

        // Получаем записи с link_keywords (в виде CSV строки)
        const result = await client.query(`
          SELECT id, seo_link_keywords, _locale
          FROM navi."${table}"
          WHERE seo_link_keywords IS NOT NULL 
            AND seo_link_keywords != ''
        `);

        console.log(`Found ${result.rows.length} records with link_keywords`);

        for (const row of result.rows) {
          const original = row.seo_link_keywords;
          
          // Парсим CSV строку вида {"keyword1","keyword2"}
          let keywords = original
            .replace(/^\{/, '')
            .replace(/\}$/, '')
            .split('","')
            .map(kw => kw.replace(/^"/, '').replace(/"$/, ''))
            .map(cleanKeyword)
            .filter(Boolean);

          // Создаем очищенную CSV строку
          const cleaned = keywords.length > 0 
            ? keywords.join(', ')
            : '';

          if (original !== original.replace(/^\{/, '').replace(/\}$/, '').replace(/"/g, '').split(',').join(', ')) {
            await client.query(`
              UPDATE navi."${table}"
              SET seo_link_keywords = $1
              WHERE id = $2
            `, [cleaned, row.id]);

            console.log(`✓ Updated record ${row.id} (${row._locale}):`);
            console.log(`  Before: ${original.substring(0, 60)}...`);
            console.log(`  After:  ${cleaned.substring(0, 60)}...`);
            totalUpdated++;
          }
        }

        console.log(`Updated ${totalUpdated} records in ${table}`);

      } catch (tableError) {
        console.error(`Error processing ${table}:`, tableError.message);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total records updated: ${totalUpdated}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

cleanupLocalesLinkKeywords();
