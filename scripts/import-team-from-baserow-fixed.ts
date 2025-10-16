#!/usr/bin/env tsx

import 'dotenv/config';

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import fetch from 'node-fetch';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical';
import type { SanitizedServerEditorConfig } from '@payloadcms/richtext-lexical';

import payloadConfig from '../src/payload.config';
import { generateSlug } from '../src/utils/slug';
import { simpleEditorFeatures } from '../src/utils/lexicalConfig';

// Workaround для undici проблемы в Payload v3
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('CacheStorage')) return;
  originalWarn(...args);
};

const BASEROW_TABLE_ID = 356533;
const BASEROW_ENDPOINT = `https://api.baserow.io/api/database/rows/table/${BASEROW_TABLE_ID}/?user_field_names=true&size=200`;
const BASEROW_POSTS_TABLE_ID = 356544;
const BASEROW_POSTS_ENDPOINT = `https://api.baserow.io/api/database/rows/table/${BASEROW_POSTS_TABLE_ID}/?user_field_names=true&size=200`;
const TEMP_DIR_PREFIX = path.join(os.tmpdir(), 'navi-team-import-');

const BASEROW_API_KEY = process.env.BASEROW_API_KEY;
if (!BASEROW_API_KEY) {
  throw new Error('BASEROW_API_KEY is not defined');
}

type LocaleCode = 'ru' | 'uk' | 'en';

type BaserowImage = {
  url: string;
  visible_name?: string | null;
};

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
  'Phone Number'?: string | null;
  'Twitter Link'?: string | null;
  'Facebook Link'?: string | null;
  'Instagram Link'?: string | null;
  Linkedin?: string | null;
  order?: string | number | null;
  'Profile Picture'?: BaserowImage[] | null;
  'Blog Posts'?: Array<{ id?: number | string | null }> | null;
  'Blog Posts 2'?: Array<{ id?: number | string | null }> | null;
};

type ImportStats = {
  created: number;
  updated: number;
  skipped: number;
};

type TeamDoc = {
  id: string;
  slug: string;
  photoId?: number | string;
};

type ExistingIndex = {
  bySlug: Map<string, TeamDoc>;
  byEmail: Map<string, TeamDoc>;
  byName: Map<string, TeamDoc>;
};

type LexicalState = Awaited<ReturnType<typeof convertMarkdownToLexical>>;

const normalizeMarkdown = (value?: string | null): string => {
  if (!value) {
    return '';
  }

  return value.replace(/\r\n/g, '\n').trim();
};

const normalizeName = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined;
  }

  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
};

const sanitizeFilename = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const selectFirstImage = (images?: BaserowImage[] | null): BaserowImage | null => {
  if (!images || images.length === 0) {
    return null;
  }

  return images.find((image) => image?.url) ?? null;
};

const fetchBaserowRows = async (): Promise<BaserowRow[]> => {
  const response = await fetch(BASEROW_ENDPOINT, {
    headers: {
      Authorization: `Token ${BASEROW_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Baserow Team rows: HTTP ${response.status}`);
  }

  const json = (await response.json()) as { results: BaserowRow[] };
  return json.results;
};

type BaserowPostRow = {
  id: number;
  Slug?: string | null;
};

const fetchBaserowPostSlugs = async (): Promise<Map<number, string>> => {
  const response = await fetch(BASEROW_POSTS_ENDPOINT, {
    headers: {
      Authorization: `Token ${BASEROW_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Baserow Posts rows: HTTP ${response.status}`);
  }

  const json = (await response.json()) as { results: BaserowPostRow[] };
  const map = new Map<number, string>();

  for (const row of json.results) {
    if (typeof row.id === 'number' && row.Slug) {
      map.set(row.id, row.Slug.trim());
    }
  }

  return map;
};

const extractPostSlugsFromRow = (
  row: BaserowRow,
  postsById: Map<number, string>,
): string[] => {
  const candidates: Array<{ id?: number | string | null }> = [];

  if (Array.isArray(row['Blog Posts'])) {
    candidates.push(...row['Blog Posts']);
  }

  if (Array.isArray(row['Blog Posts 2'])) {
    candidates.push(...row['Blog Posts 2']);
  }

  const slugs = new Set<string>();

  for (const item of candidates) {
    const rawId = item?.id;
    if (typeof rawId === 'number') {
      const slug = postsById.get(rawId);
      if (slug) {
        slugs.add(slug);
      }
      continue;
    }

    if (typeof rawId === 'string') {
      const numeric = Number.parseInt(rawId, 10);
      if (!Number.isNaN(numeric)) {
        const slug = postsById.get(numeric);
        if (slug) {
          slugs.add(slug);
        }
      }
    }
  }

  return Array.from(slugs);
};

const mapPostSlugsToPayloadIds = (
  slugs: string[],
  payloadPostIdsBySlug: Map<string, number>,
): number[] => {
  const ids: number[] = [];
  const seen = new Set<number>();

  for (const slug of slugs) {
    const payloadId = payloadPostIdsBySlug.get(slug);
    if (payloadId != null && !seen.has(payloadId)) {
      ids.push(payloadId);
      seen.add(payloadId);
    }
  }

  return ids;
};

const fetchPayloadPosts = async (payloadClient: Payload): Promise<Map<string, number>> => {
  const result = await payloadClient.find({
    collection: 'posts' as const,
    limit: 1000,
    depth: 0,
  });

  const map = new Map<string, number>();
  for (const doc of result.docs as Array<Record<string, unknown>>) {
    const slug = typeof doc.slug === 'string' ? doc.slug.trim() : undefined;
    const idValue = (doc as { id?: unknown }).id;

    let numericId: number | undefined;
    if (typeof idValue === 'number') {
      numericId = idValue;
    } else if (typeof idValue === 'string' && idValue.length > 0) {
      const parsed = Number.parseInt(idValue, 10);
      if (!Number.isNaN(parsed)) {
        numericId = parsed;
      }
    }

    if (slug && numericId != null) {
      map.set(slug, numericId);
    }
  }

  return map;
};

const convertMarkdown = async (
  editorConfig: SanitizedServerEditorConfig,
  markdown?: string | null,
): Promise<LexicalState> => {
  const normalized = normalizeMarkdown(markdown);

  return convertMarkdownToLexical({
    editorConfig,
    markdown: normalized,
  });
};

const uploadMediaFromUrl = async (
  payloadClient: Payload,
  url: string,
  filenameBase: string,
  alt?: string,
): Promise<number | string | undefined> => {
  if (!url) {
    return undefined;
  }

  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`Unable to download image ${url}: HTTP ${response.status}`);
    return undefined;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    console.warn(`Empty image buffer for ${url}`);
    return undefined;
  }

  const tempDir = await fs.mkdtemp(TEMP_DIR_PREFIX);
  const extension = path.extname(new URL(url).pathname).replace('.', '') || 'jpg';
  const filename = `${filenameBase}.${extension}`;
  const filepath = path.join(tempDir, filename);

  await fs.writeFile(filepath, buffer);

  try {
    const created = await (payloadClient as any).create({
      collection: 'media',
      data: { alt },
      filePath: filepath,
    });
    const createdId = created?.id;

    if (typeof createdId === 'number') {
      return createdId;
    }

    if (typeof createdId === 'string') {
      const numeric = Number.parseInt(createdId, 10);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }

      return createdId;
    }

    console.warn(`Unexpected media id type for ${url}: ${typeof createdId}`);
    return undefined;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
};

const buildLinks = (row: BaserowRow) => {
  const links: Array<{ service: string; url: string }> = [];

  const email = row.Email?.trim();
  if (email) {
    links.push({ service: 'email', url: `mailto:${email}` });
  }

  const phone = row['Phone Number']?.trim();
  if (phone) {
    const phoneValue = phone.startsWith('tel:') ? phone : `tel:${phone.replace(/\s+/g, '')}`;
    links.push({ service: 'phone', url: phoneValue });
  }

  const twitter = row['Twitter Link']?.trim();
  if (twitter) {
    links.push({ service: 'x', url: twitter });
  }

  const facebook = row['Facebook Link']?.trim();
  if (facebook) {
    links.push({ service: 'facebook', url: facebook });
  }

  const instagram = row['Instagram Link']?.trim();
  if (instagram) {
    links.push({ service: 'instagram', url: instagram });
  }

  const linkedin = row.Linkedin?.trim();
  if (linkedin) {
    links.push({ service: 'linkedin', url: linkedin });
  }

  return links;
};

const extractPhotoId = (photo: unknown): number | string | undefined => {
  if (typeof photo === 'number') {
    return photo;
  }

  if (typeof photo === 'string') {
    const numeric = Number.parseInt(photo, 10);
    return Number.isNaN(numeric) ? photo : numeric;
  }

  if (photo && typeof photo === 'object') {
    if ('id' in photo) {
      const id = (photo as { id?: unknown }).id;
      if (typeof id === 'number') {
        return id;
      }
      if (typeof id === 'string') {
        const numeric = Number.parseInt(id, 10);
        return Number.isNaN(numeric) ? id : numeric;
      }
    }
    if ('value' in photo) {
      const value = (photo as { value?: unknown }).value;
      if (typeof value === 'number') {
        return value;
      }
      if (typeof value === 'string') {
        const numeric = Number.parseInt(value, 10);
        return Number.isNaN(numeric) ? value : numeric;
      }
    }
  }

  return undefined;
};

const fetchExistingTeamDocs = async (payloadClient: Payload): Promise<ExistingIndex> => {
  const result = await payloadClient.find({
    collection: 'team-new',
    limit: 200,
    locale: 'all',
    depth: 0,
  });

  const bySlug = new Map<string, TeamDoc>();
  const byEmail = new Map<string, TeamDoc>();
  const byName = new Map<string, TeamDoc>();

  const registerNames = (doc: TeamDoc, rawValue: unknown) => {
    const handleString = (value: string) => {
      const normalized = normalizeName(value);
      if (normalized) {
        byName.set(normalized, doc);
      }
    };

    if (typeof rawValue === 'string') {
      handleString(rawValue);
      return;
    }

    if (rawValue && typeof rawValue === 'object') {
      for (const value of Object.values(rawValue as Record<string, unknown>)) {
        if (typeof value === 'string') {
          handleString(value);
        }
      }
    }
  };

  for (const rawDoc of result.docs as Array<Record<string, unknown>>) {
    const slug = typeof rawDoc.slug === 'string' ? rawDoc.slug : undefined;
    const id = rawDoc.id != null ? String(rawDoc.id) : undefined;
    if (!slug || !id) {
      continue;
    }

    const doc: TeamDoc = {
      id,
      slug,
      photoId: extractPhotoId(rawDoc.photo),
    };

    bySlug.set(slug, doc);

    registerNames(doc, rawDoc.name);

    const links = Array.isArray(rawDoc.links) ? rawDoc.links : [];
    for (const link of links as Array<Record<string, unknown>>) {
      const url = typeof link?.url === 'string' ? link.url : undefined;
      if (url?.startsWith('mailto:')) {
        const email = url.slice('mailto:'.length).toLowerCase();
        if (email) {
          byEmail.set(email, doc);
        }
      }
    }
  }

  return { bySlug, byEmail, byName };
};

const updateNameIndex = (
  index: ExistingIndex,
  doc: TeamDoc,
  locales: Partial<Record<LocaleCode, string>>,
): void => {
  for (const value of Object.values(locales)) {
    const normalized = normalizeName(value ?? undefined);
    if (normalized) {
      index.byName.set(normalized, doc);
    }
  }
};

const resolveExistingDoc = (row: BaserowRow, index: ExistingIndex): TeamDoc | undefined => {
  const slugFromRow = row.Slug?.trim();
  if (slugFromRow) {
    const bySlug = index.bySlug.get(slugFromRow);
    if (bySlug) {
      return bySlug;
    }
  }

  const fallbackName = row.Name_RU?.trim() || row.Name_UA?.trim() || row.Name_EN?.trim();
  if (fallbackName) {
    const generated = generateSlug(fallbackName);
    const byGeneratedSlug = index.bySlug.get(generated);
    if (byGeneratedSlug) {
      return byGeneratedSlug;
    }

    const normalized = normalizeName(fallbackName);
    if (normalized) {
      const byName = index.byName.get(normalized);
      if (byName) {
        return byName;
      }
    }
  }

  const email = row.Email?.trim()?.toLowerCase();
  if (email) {
    const byEmail = index.byEmail.get(email);
    if (byEmail) {
      return byEmail;
    }
  }

  return undefined;
};

const convertLocales = async (
  editorConfig: SanitizedServerEditorConfig,
  row: BaserowRow,
): Promise<{
  names: Partial<Record<LocaleCode, string>>;
  positions: Partial<Record<LocaleCode, string>>;
  bioSummaries: Partial<Record<LocaleCode, LexicalState>>;
  bios: Partial<Record<LocaleCode, LexicalState>>;
}> => {
  const names: Partial<Record<LocaleCode, string>> = {
    ru: row.Name_RU?.trim() || undefined,
    uk: row.Name_UA?.trim() || undefined,
    en: row.Name_EN?.trim() || undefined,
  };

  const positions: Partial<Record<LocaleCode, string>> = {
    ru: row['Job Title_RU']?.trim() || undefined,
    uk: row['Job Title_UA']?.trim() || undefined,
    en: row['Job Title_EN']?.trim() || undefined,
  };

  const bioSummaries: Partial<Record<LocaleCode, LexicalState>> = {
    ru: await convertMarkdown(editorConfig, row['Bio Summary_RU']),
    uk: await convertMarkdown(editorConfig, row['Bio Summary_UA']),
    en: await convertMarkdown(editorConfig, row['Bio Summary_EN']),
  };

  const bios: Partial<Record<LocaleCode, LexicalState>> = {
    ru: await convertMarkdown(editorConfig, row.Bio_RU),
    uk: await convertMarkdown(editorConfig, row.Bio_UA),
    en: await convertMarkdown(editorConfig, row.Bio_EN),
  };

  return { names, positions, bioSummaries, bios };
};

const upsertTeamMember = async (
  payloadClient: Payload,
  editorConfig: SanitizedServerEditorConfig,
  row: BaserowRow,
  existingIndex: ExistingIndex,
  postsById: Map<number, string>,
  payloadPostsBySlug: Map<string, string>,
): Promise<'created' | 'updated'> => {
  const baseName = row.Name_RU?.trim() || row.Name_UA?.trim() || row.Name_EN?.trim();
  if (!baseName) {
    throw new Error(`Row ${row.id} is missing name`);
  }

  const existingDoc = resolveExistingDoc(row, existingIndex);
  const slugFromRow = row.Slug?.trim() || generateSlug(baseName);
  const targetSlug = slugFromRow;

  const { names, positions, bioSummaries, bios } = await convertLocales(editorConfig, row);
  const links = buildLinks(row);
  const postSlugs = extractPostSlugsFromRow(row, postsById);
  const postIds = mapPostSlugsToPayloadIds(postSlugs, payloadPostsBySlug);

  const orderRaw = typeof row.order === 'string' ? Number.parseFloat(row.order) : row.order;
  const order = typeof orderRaw === 'number' && Number.isFinite(orderRaw) ? Math.round(orderRaw) : undefined;

  let photoId = existingDoc?.photoId;
  if (!photoId) {
    const firstImage = selectFirstImage(row['Profile Picture']);
    if (firstImage?.url) {
      photoId = await uploadMediaFromUrl(
        payloadClient,
        firstImage.url,
        sanitizeFilename(`${targetSlug}-photo`),
        baseName,
      );
    }
  }

  const ruData: Record<string, unknown> = {
    slug: targetSlug,
    links,
    order,
    _status: 'published',
  };

  if (postIds.length > 0) {
    ruData.posts = postIds;
  } else {
    ruData.posts = [];
  }

  if (names.ru) {
    ruData.name = names.ru;
  }

  if (positions.ru) {
    ruData.position = positions.ru;
  }

  ruData.bio_summary = bioSummaries.ru;
  ruData.bio = bios.ru;

  if (photoId) {
    ruData.photo = photoId;
  }

  let documentId: string;

  if (existingDoc) {
    if (existingDoc.slug !== targetSlug) {
      existingIndex.bySlug.delete(existingDoc.slug);
      existingDoc.slug = targetSlug;
    }
    documentId = existingDoc.id;
    await (payloadClient as any).update({
      collection: 'team-new',
      id: documentId,
      locale: 'ru',
      data: ruData,
    });
  } else {
    const created = await (payloadClient as any).create({
      collection: 'team-new',
      locale: 'ru',
      data: ruData,
    });
    documentId = String(created.id);
  }

  const otherLocales: LocaleCode[] = ['uk', 'en'];

  for (const locale of otherLocales) {
    const localizedData: Record<string, unknown> = {};

    if (names[locale]) {
      localizedData.name = names[locale];
    }

    if (positions[locale]) {
      localizedData.position = positions[locale];
    }

    localizedData.bio_summary = bioSummaries[locale];
    localizedData.bio = bios[locale];

    await (payloadClient as any).update({
      collection: 'team-new',
      id: documentId,
      locale,
      data: localizedData,
    });
  }

  existingIndex.bySlug.set(targetSlug, {
    id: documentId,
    slug: targetSlug,
    photoId,
  });

  const normalizedEmail = row.Email?.trim()?.toLowerCase();
  if (normalizedEmail) {
    existingIndex.byEmail.set(normalizedEmail, {
      id: documentId,
      slug: targetSlug,
      photoId,
    });
  }

  updateNameIndex(existingIndex, { id: documentId, slug: targetSlug, photoId }, names);

  return existingDoc ? 'updated' : 'created';
};

async function main() {
  const payloadClient = await getPayload({ config: payloadConfig });

  const editorConfig = (await editorConfigFactory.fromFeatures({
    config: payloadClient.config,
    features: () => simpleEditorFeatures,
    parentIsLocalized: true,
  })) as SanitizedServerEditorConfig;

  const rows = await fetchBaserowRows();
  const postsById = await fetchBaserowPostSlugs();
  const existingIndex = await fetchExistingTeamDocs(payloadClient);
  const payloadPostsBySlug = await fetchPayloadPosts(payloadClient);

  console.log(`Fetched ${rows.length} team members from Baserow`);

  const stats: ImportStats = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const row of rows) {
    try {
      const status = await upsertTeamMember(
        payloadClient,
        editorConfig,
        row,
        existingIndex,
        postsById,
        payloadPostsBySlug,
      );
      stats[status] += 1;
      console.log(`✔ ${status.toUpperCase()}: ${row.Name_RU || row.Name_UA || row.Name_EN || row.id}`);
    } catch (error) {
      stats.skipped += 1;
      const message = (error as Error).message;
      console.error(`✖ Failed to import team member ${row.id}: ${message}`);
      const details = (error as { errors?: unknown }).errors;
      if (details) {
        console.error(JSON.stringify(details, null, 2));
      }
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
  }

  console.log('\nImport finished');
  console.log(`  Created: ${stats.created}`);
  console.log(`  Updated: ${stats.updated}`);
  console.log(`  Skipped: ${stats.skipped}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
