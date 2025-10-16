#!/usr/bin/env tsx

import 'dotenv/config';
import fetch from 'node-fetch';
import { getPayload } from 'payload';
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical';
import type { SanitizedServerEditorConfig } from '@payloadcms/richtext-lexical';
import config from '../src/payload.config';
import { simpleEditorFeatures } from '../src/utils/lexicalConfig';

// Workaround для undici проблемы в Payload v3
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('CacheStorage')) return;
  originalWarn(...args);
};

const BASEROW_TABLE_ID = 356533;
const BASEROW_ENDPOINT = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=200`;

const BASEROW_API_KEY = process.env.BASEROW_API_KEY;
if (!BASEROW_API_KEY) {
  throw new Error('BASEROW_API_KEY is not defined');
}

type LocaleCode = 'ru' | 'uk' | 'en';

type BaserowRow = {
  id: number;
  Slug?: string | null;
  Name_RU?: string | null;
  Name_UA?: string | null;
  Name_EN?: string | null;
  'Bio Summary_RU'?: string | null;
  'Bio Summary_UA'?: string | null;
  'Bio Summary_EN'?: string | null;
  Bio_RU?: string | null;
  Bio_UA?: string | null;
  Bio_EN?: string | null;
  'Job Title_RU'?: string | null;
  'Job Title_UA'?: string | null;
  'Job Title_EN'?: string | null;
  Email?: string | null;
};

const normalizeMarkdown = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  return value.replace(/\r\n/g, '\n').trim();
};

const convertMarkdown = async (
  editorConfig: SanitizedServerEditorConfig,
  markdown?: string | null,
): Promise<any> => {
  const normalized = normalizeMarkdown(markdown);
  return convertMarkdownToLexical({
    editorConfig,
    markdown: normalized,
  });
};

async function main() {
  const payload = await getPayload({ config });

  const editorConfig = (await editorConfigFactory.fromFeatures({
    config: payload.config,
    features: () => simpleEditorFeatures,
    parentIsLocalized: true,
  })) as SanitizedServerEditorConfig;

  // Получить данные из Baserow
  const response = await fetch(BASEROW_ENDPOINT, {
    headers: {
      Authorization: `Token ${BASEROW_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Baserow Team rows: HTTP ${response.status}`);
  }

  const json = (await response.json()) as { results: BaserowRow[] };
  const baserowRows = json.results;

  console.log(`Fetched ${baserowRows.length} team members from Baserow`);

  // Получить существующие записи из Payload
  const result = await payload.find({
    collection: 'team-new',
    limit: 100,
  });

  console.log(`Found ${result.docs.length} team members in Payload`);

  // Создать карту сопоставления по email
  const payloadByEmail = new Map<string, any>();
  for (const doc of result.docs) {
    // Найти email в links
    const links = doc.links || [];
    for (const link of links) {
      if (link.url?.startsWith('mailto:')) {
        const email = link.url.slice('mailto:'.length).toLowerCase();
        payloadByEmail.set(email, doc);
        break;
      }
    }
  }

  for (const row of baserowRows) {
    const email = row.Email?.trim()?.toLowerCase();
    const existingDoc = email ? payloadByEmail.get(email) : null;

    if (!existingDoc) {
      console.log(`No matching record found for email: ${email}`);
      continue;
    }

    console.log(`Updating: ${row.Name_RU || row.Name_UA || row.Name_EN || row.id}`);

    // Конвертировать биографии
    const bioSummaries = {
      ru: await convertMarkdown(editorConfig, row['Bio Summary_RU']),
      uk: await convertMarkdown(editorConfig, row['Bio Summary_UA']),
      en: await convertMarkdown(editorConfig, row['Bio Summary_EN']),
    };

    const bios = {
      ru: await convertMarkdown(editorConfig, row.Bio_RU),
      uk: await convertMarkdown(editorConfig, row.Bio_UA),
      en: await convertMarkdown(editorConfig, row.Bio_EN),
    };

    // Обновить русскую версию (основная)
    await payload.update({
      collection: 'team-new',
      id: existingDoc.id,
      locale: 'ru',
      data: {
        name: row.Name_RU?.trim(),
        position: row['Job Title_RU']?.trim(),
        bio_summary: bioSummaries.ru,
        bio: bios.ru,
      },
    });

    // Обновить украинскую версию
    await payload.update({
      collection: 'team-new',
      id: existingDoc.id,
      locale: 'uk',
      data: {
        name: row.Name_UA?.trim(),
        position: row['Job Title_UA']?.trim(),
        bio_summary: bioSummaries.uk,
        bio: bios.uk,
      },
    });

    // Обновить английскую версию
    await payload.update({
      collection: 'team-new',
      id: existingDoc.id,
      locale: 'en',
      data: {
        name: row.Name_EN?.trim(),
        position: row['Job Title_EN']?.trim(),
        bio_summary: bioSummaries.en,
        bio: bios.en,
      },
    });

    console.log(`✅ Updated: ${email}`);
  }

  console.log('Update completed');

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
