#!/usr/bin/env tsx

import 'dotenv/config';

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import mime from 'mime-types';
import fetch from 'node-fetch';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical';
import type { SanitizedServerEditorConfig } from '@payloadcms/richtext-lexical';

import payloadConfig from '../src/payload.config';
import { generateSlug } from '../src/utils/slug';
import { simpleEditorFeatures } from '../src/utils/lexicalConfig';

const BASEROW_TABLE_ID = 389127;
const BASEROW_ENDPOINT = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=200`;
const TEMP_DIR_PREFIX = path.join(os.tmpdir(), 'navi-certificates-import-');

const BASEROW_API_KEY = process.env.BASEROW_API_KEY;
if (!BASEROW_API_KEY) {
  throw new Error('BASEROW_API_KEY is not defined');
}

type LexicalState = Awaited<ReturnType<typeof convertMarkdownToLexical>>;

type BaserowImage = {
  url: string;
  visible_name?: string | null;
};

type BaserowRow = {
  id: number;
  Name: string;
  Description_RU?: string | null;
  Description_UA?: string | null;
  Description_EN?: string | null;
  Requirements_RU?: string | null;
  Requirements_UA?: string | null;
  Requirements_EN?: string | null;
  Main_image?: BaserowImage[] | null;
  Back_Image?: BaserowImage[] | null;
};

type ImportStats = {
  created: number;
  updated: number;
  skipped: number;
};

type LocaleCode = 'ru' | 'uk' | 'en';

const mediaCache = new Map<string, string>();

const sanitizeFilenameFragment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const normalizeMarkdown = (value?: string | null): string => {
  if (!value) {
    return '';
  }

  return value
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n')
    .trim();
};

const selectFirstImage = (images?: BaserowImage[] | null): BaserowImage | null => {
  if (!images || images.length === 0) {
    return null;
  }

  const valid = images.find((img) => img && typeof img.url === 'string' && img.url.length > 0);
  return valid ?? null;
};

const fetchBaserowRows = async (): Promise<BaserowRow[]> => {
  const response = await fetch(BASEROW_ENDPOINT, {
    headers: {
      Authorization: `Token ${BASEROW_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Baserow rows: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { results: BaserowRow[] };
  return json.results ?? [];
};

const ensureTempDir = async () => {
  return fs.mkdtemp(TEMP_DIR_PREFIX);
};

const downloadFile = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file ${url}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') ?? undefined;
  return { buffer, contentType };
};

const uploadMediaFromUrl = async (
  payloadClient: Payload,
  url: string,
  filenameBase: string,
  alt: string,
): Promise<string> => {
  const cached = mediaCache.get(url);
  if (cached) {
    return cached;
  }

  const { buffer, contentType } = await downloadFile(url);
  const extensionFromMime = contentType ? mime.extension(contentType) : null;
  const urlObject = new URL(url);
  const urlExt = path.extname(urlObject.pathname).replace('.', '');
  const extension = extensionFromMime || urlExt || 'bin';

  const tempDir = await ensureTempDir();
  let attempt = 0;
  let filename = `${filenameBase}.${extension}`;
  let filepath = path.join(tempDir, filename);

  await fs.writeFile(filepath, buffer);

  try {
    while (attempt < 3) {
      try {
        const created = await payloadClient.create({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          collection: 'media' as any,
          data: { alt },
          filePath: filepath,
        });

        const id = created.id as string;
        mediaCache.set(url, id);
        await fs.rm(tempDir, { recursive: true, force: true });
        return id;
      } catch (error) {
        const message = (error as Error).message ?? '';
        if (!message.toLowerCase().includes('filename') || attempt === 2) {
          throw error;
        }

        attempt += 1;
        filename = `${filenameBase}-${Date.now().toString(36)}-${attempt}.${extension}`;
        const nextPath = path.join(tempDir, filename);
        await fs.rename(filepath, nextPath);
        filepath = nextPath;
      }
    }

    throw new Error('Unable to upload media after multiple attempts');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
};

const convertMarkdown = async (
  editorConfig: SanitizedServerEditorConfig,
  markdown?: string | null,
): Promise<LexicalState> => {
  const normalized = normalizeMarkdown(markdown);
  if (!normalized) {
    return convertMarkdownToLexical({
      editorConfig,
      markdown: '',
    });
  }

  return convertMarkdownToLexical({
    editorConfig,
    markdown: normalized,
  });
};

const upsertCertificate = async (
  payloadClient: Payload,
  editorConfig: SanitizedServerEditorConfig,
  row: BaserowRow,
): Promise<'created' | 'updated'> => {
  const name = row.Name.trim();
  const slug = generateSlug(name);

  const frontImage = selectFirstImage(row.Main_image);
  const backImage = selectFirstImage(row.Back_Image);

  const frontImageId = frontImage
    ? await uploadMediaFromUrl(
        payloadClient,
        frontImage.url,
        sanitizeFilenameFragment(`${slug}-front`),
        `${name} – front`,
      )
    : undefined;

  const backImageId = backImage
    ? await uploadMediaFromUrl(
        payloadClient,
        backImage.url,
        sanitizeFilenameFragment(`${slug}-back`),
        `${name} – back`,
      )
    : undefined;

  const descriptions: Record<LocaleCode, LexicalState> = {
    ru: await convertMarkdown(editorConfig, row.Description_RU),
    uk: await convertMarkdown(editorConfig, row.Description_UA),
    en: await convertMarkdown(editorConfig, row.Description_EN),
  };

  const requirements: Record<LocaleCode, LexicalState> = {
    ru: await convertMarkdown(editorConfig, row.Requirements_RU),
    uk: await convertMarkdown(editorConfig, row.Requirements_UA),
    en: await convertMarkdown(editorConfig, row.Requirements_EN),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (payloadClient as any).find({
    collection: 'certificates-new',
    where: {
      slug: {
        equals: slug,
      },
    },
    limit: 1,
    locale: 'ru',
  });

  const payloadData = {
    name,
    slug,
    frontImage: frontImageId,
    backImage: backImageId,
    description: descriptions.ru,
    requirements: requirements.ru,
    program: await convertMarkdown(editorConfig, undefined),
    _status: 'published' as const,
  };

  let certificateId: string;
  let status: 'created' | 'updated';

  if (existing.docs.length > 0) {
    const existingDoc = existing.docs[0];
    certificateId = existingDoc.id as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payloadClient as any).update({
      collection: 'certificates-new',
      id: certificateId,
      data: payloadData,
      locale: 'ru',
    });
    status = 'updated';
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (payloadClient as any).create({
      collection: 'certificates-new',
      data: payloadData,
      locale: 'ru',
    });
    certificateId = created.id as string;
    status = 'created';
  }

  const locales: LocaleCode[] = ['uk', 'en'];
  for (const locale of locales) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payloadClient as any).update({
      collection: 'certificates-new',
      id: certificateId,
      data: {
        name,
        slug,
        description: descriptions[locale],
        requirements: requirements[locale],
        program: await convertMarkdown(editorConfig, undefined),
      },
      locale,
    });
  }

  return status;
};

async function main() {
  const payloadClient = await getPayload({ config: payloadConfig });
  const sanitizedEditorConfig = (await editorConfigFactory.fromFeatures({
    config: payloadClient.config,
    features: () => simpleEditorFeatures,
    parentIsLocalized: true,
  })) as SanitizedServerEditorConfig;

  const rows = await fetchBaserowRows();
  console.log(`Fetched ${rows.length} certificates from Baserow`);

  const stats: ImportStats = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    if (!row?.Name) {
      stats.skipped += 1;
      continue;
    }

    try {
      const status = await upsertCertificate(payloadClient, sanitizedEditorConfig, row);
      stats[status] += 1;
      console.log(`✔ ${status.toUpperCase()}: ${row.Name}`);
    } catch (error) {
      stats.skipped += 1;
      console.error(`✖ Failed to import certificate "${row.Name}": ${(error as Error).message}`);
    }
  }

  console.log('\nImport finished');
  console.log(`  Created: ${stats.created}`);
  console.log(`  Updated: ${stats.updated}`);
  console.log(`  Skipped: ${stats.skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
