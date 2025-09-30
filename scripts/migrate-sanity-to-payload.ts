#!/usr/bin/env tsx

/* eslint-disable @typescript-eslint/no-explicit-any */

import 'dotenv/config';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createClient } from '@sanity/client';
import type { PortableTextBlock } from '@portabletext/types';
import payload from 'payload';
import fetch, { Headers, Request, Response } from 'node-fetch';
import mime from 'mime-types';
import payloadConfig from '../src/payload.config';

if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
}
if (!globalThis.Headers) {
  globalThis.Headers = Headers as any;
}
if (!globalThis.Request) {
  globalThis.Request = Request as any;
}
if (!globalThis.Response) {
  globalThis.Response = Response as any;
}

// ----------------------------------------
// Types
// ----------------------------------------

type MigrationOptions = {
  dryRun: boolean;
  skipMedia: boolean;
};

type SanityImageAsset = { _ref: string };

type SanityReference = { _ref: string };

type SanitySeo = {
  overall_ui?: string | null;
  title?: string | null;
  meta_description?: string | null;
  og_image?: { asset?: SanityImageAsset | null } | null;
  no_index?: boolean | null;
  no_follow?: boolean | null;
  focus_keyphrase?: string | null;
  additional_fields?: {
    link_keywords?: string[] | null;
  } | null;
};

type SanityTranslation = {
  language: 'ru' | 'ua' | 'en';
  name?: string | null;
  slug?: { current: string } | string | null;
  summary?: string | null;
  content?: PortableTextBlock[] | null;
  seo?: SanitySeo | null;
};

type SanityPost = {
  _id: string;
  name: string;
  slug: { current: string };
  author?: { _id: string } | SanityReference | null;
  image?: { asset?: SanityImageAsset | null } | null;
  summary?: string | null;
  social_images?: {
    thumbnail?: { asset?: SanityImageAsset | null } | null;
    image_16x9?: { asset?: SanityImageAsset | null } | null;
    image_5x4?: { asset?: SanityImageAsset | null } | null;
  } | null;
  content?: PortableTextBlock[] | null;
  tags?: SanityReference[] | null;
  faqs?: SanityReference[] | null;
  translations?: SanityTranslation[] | null;
  seo?: SanitySeo | null;
  featured?: boolean | null;
  publishedAt?: string | null;
};

type SanityTag = {
  _id: string;
  name: string;
  slug: { current: string };
  image?: { asset?: SanityImageAsset | null } | null;
  summary?: string | null;
  content?: PortableTextBlock[] | null;
  description_for_ai?: string | null;
  posts?: SanityReference[] | null;
  faqs?: SanityReference[] | null;
  translations?: SanityTranslation[] | null;
  seo?: SanitySeo | null;
};

type SanityFaq = {
  _id: string;
  question: string;
  answer?: PortableTextBlock[] | null;
  tags?: SanityReference[] | null;
  posts?: SanityReference[] | null;
  translations?: SanityTranslation[] | null;
  seo?: SanitySeo | null;
};

type SanityTeamMember = {
  _id: string;
  name: string;
  slug?: { current: string } | string | null;
  position?: string | null;
  bio?: PortableTextBlock[] | null;
  bio_summary?: string | null;
  photo?: { asset?: SanityImageAsset | null } | null;
  email?: string | null;
  links?: { service?: string | null; link?: string | null }[] | null;
  posts?: SanityReference[] | null;
  certificates?: SanityReference[] | null;
  trainings?: SanityReference[] | null;
  faqs?: SanityReference[] | null;
  translations?: SanityTranslation[] | null;
  seo?: SanitySeo | null;
};

type SanityCertificate = {
  _id: string;
  title: string;
  slug: { current: string };
  description?: PortableTextBlock[] | null;
  image?: { asset?: SanityImageAsset | null } | null;
  issuer?: string | null;
  issued_date?: string | null;
  expiry_date?: string | null;
  translations?: {
    language: 'ru' | 'ua' | 'en';
    title?: string | null;
    description?: PortableTextBlock[] | null;
  }[] | null;
  seo?: SanitySeo | null;
};

type SanityTraining = {
  _id: string;
  name: string;
  slug: { current: string };
  translations?: SanityTranslation[] | null;
  seo?: SanitySeo | null;
};

type SanityRedirect = {
  from_path: string;
  to_path: string;
  status_code?: number | null;
  created_at?: string | null;
};

type SanityGlobals = {
  title?: string | null;
  tagline?: string | null;
  description?: string | null;
  url?: string | null;
  favicon?: { asset?: SanityImageAsset | null } | null;
  logo?: { asset?: SanityImageAsset | null } | null;
  logo_dark_mode?: { asset?: SanityImageAsset | null } | null;
  accent_color?: string | null;
  social_links?: { service?: string | null; url?: string | null }[] | null;
};

type Counts = { created: number; updated: number };

type PendingRelations = {
  tagPosts: Map<string, string[]>;
  tagFaqs: Map<string, string[]>;
  faqPosts: Map<string, string[]>;
  teamPosts: Map<string, string[]>;
};

type PayloadCollection =
  | 'certificates'
  | 'trainings'
  | 'tags'
  | 'faqs'
  | 'team'
  | 'posts'
  | 'redirects';

// ----------------------------------------
// ----------------------------------------

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

const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID ?? 'ijo6q4md';
const SANITY_DATASET = process.env.SANITY_DATASET ?? 'production';
const SANITY_TOKEN = process.env.SANITY_API_TOKEN;

const TEMP_DIR_PREFIX = path.join(os.tmpdir(), 'navi-payload-sanity-migration-');

const sanity = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: '2023-05-03',
  useCdn: false,
  token: SANITY_TOKEN,
});

const mediaCache = new Map<string, string>();

// ----------------------------------------
// Helpers
// ----------------------------------------

const removeUndefined = <T extends Record<string, unknown>>(object: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null),
  ) as Partial<T>;
};

const normalizeLanguage = (value?: string | null): 'ru' | 'ua' | 'en' | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 'ru' || normalized.startsWith('ru-')) return 'ru';
  if (normalized === 'ua' || normalized === 'uk' || normalized.startsWith('ua-') || normalized.startsWith('uk-')) return 'ua';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return null;
};

const sanitizeFilenameFragment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

const sanityAssetToUrl = (asset?: SanityImageAsset | null): string | null => {
  if (!asset?._ref) return null;
  const [, id, size, format] = asset._ref.split('-');
  if (!id || !format) return null;
  return `https://cdn.sanity.io/images/${SANITY_PROJECT_ID}/${SANITY_DATASET}/${id}-${size}.${format}`;
};

const fetchBuffer = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get('content-type'),
  };
};

const uploadMedia = async (
  payloadClient: any,
  label: string,
  asset: SanityImageAsset | null | undefined,
  options: MigrationOptions,
): Promise<string | null> => {
  if (!asset?._ref) return null;

  const cached = mediaCache.get(asset._ref);
  if (cached) return cached;

  if (options.dryRun || options.skipMedia) {
    console.info(`[SKIP MEDIA] ${label} (${asset._ref})`);
    return null;
  }

  const url = sanityAssetToUrl(asset);
  if (!url) return null;

  try {
    const { buffer, contentType } = await fetchBuffer(url);
    const extension = mime.extension(contentType ?? '') || 'bin';
    const tempDir = await fs.promises.mkdtemp(TEMP_DIR_PREFIX);
    const baseFragment = sanitizeFilenameFragment(asset?._ref ?? `${label}-${Date.now().toString(36)}`) || 'asset';
    let attempt = 0;
    const cleanExtension = extension.replace(/^jpg$/, 'jpeg');
    let filename = `${baseFragment}.${cleanExtension}`;
    let tempPath = path.join(tempDir, filename);
    await fs.promises.writeFile(tempPath, buffer);

    try {
      const existing = await payloadClient.find({
        collection: 'media',
        where: { filename: { equals: filename } },
        limit: 1,
      });

      if (existing.docs?.length) {
        const id = existing.docs[0].id as string;
        mediaCache.set(asset._ref, id);
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
        return id;
      }

      while (attempt < 3) {
        try {
          const created = await payloadClient.create({
            collection: 'media',
            data: { alt: label },
            filePath: tempPath,
          });

          const id = created.id as string;
          mediaCache.set(asset._ref, id);
          await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
          return id;
        } catch (error) {
          const message = (error as Error).message ?? '';
          if (!message.toLowerCase().includes('filename') || attempt === 2) {
            throw error;
          }

          attempt += 1;
          filename = `${baseFragment}-${Date.now().toString(36)}-${attempt}.${cleanExtension}`;
          const newPath = path.join(tempDir, filename);
          await fs.promises.rename(tempPath, newPath);
          tempPath = newPath;
        }
      }

      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      return null;
    } catch (error) {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.warn(`Failed to upload media ${label}: ${(error as Error).message}`);
    return null;
  }
};

const portableTextToLexical = async (
  blocks: PortableTextBlock[] | null | undefined,
  payloadClient: any,
  options: MigrationOptions,
  language?: string,
): Promise<any> => {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return EMPTY_LEXICAL;

  const children: any[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const type = (block as any)._type;

    if (type === 'block') {
      const style = (block as any).style || 'normal';
      const blockChildren: any[] = [];
      const rawChildren = (block as any).children || [];
      const markDefs = (block as any).markDefs || [];

      for (const child of rawChildren) {
        if (!child || typeof child !== 'object') continue;
        const childType = (child as any)._type;

        if (childType === 'span') {
          const text = (child as any).text || '';
          const marks = (child as any).marks || [];

          let format = 0;
          if (marks.includes('strong')) format |= 1;
          if (marks.includes('em')) format |= 2;
          if (marks.includes('underline')) format |= 8;
          if (marks.includes('code')) format |= 16;

          const linkMark = marks.find((m: string) => markDefs.some((def: any) => def._key === m && def._type === 'link'));
          if (linkMark) {
            const linkDef = markDefs.find((def: any) => def._key === linkMark);
            if (linkDef?.href && linkDef.href.trim()) {
              blockChildren.push({
                type: 'link',
                url: linkDef.href.trim(),
                newTab: linkDef.blank === true,
                format: '',
                indent: 0,
                direction: 'ltr',
                version: 2,
                fields: {
                  linkType: 'custom',
                  url: linkDef.href.trim(),
                  newTab: linkDef.blank === true,
                },
                children: [
                  {
                    type: 'text',
                    text,
                    detail: 0,
                    format,
                    mode: 'normal',
                    style: '',
                    version: 1,
                  },
                ],
              });
              continue;
            }
          }

          blockChildren.push({
            type: 'text',
            text,
            detail: 0,
            format,
            mode: 'normal',
            style: '',
            version: 1,
          });
        }
      }

      if (style === 'normal') {
        children.push({
          type: 'paragraph',
          format: '',
          indent: 0,
          direction: 'ltr',
          version: 1,
          children: blockChildren.length ? blockChildren : [{ type: 'text', text: '', detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
        });
      } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(style)) {
        children.push({
          type: 'heading',
          tag: style,
          format: '',
          indent: 0,
          direction: 'ltr',
          version: 1,
          children: blockChildren.length ? blockChildren : [{ type: 'text', text: '', detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
        });
      } else {
        children.push({
          type: 'paragraph',
          format: '',
          indent: 0,
          direction: 'ltr',
          version: 1,
          children: blockChildren.length ? blockChildren : [{ type: 'text', text: '', detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
        });
      }
    } else if (type === 'image') {
      const asset = (block as any).asset;
      const rawAlt = (block as any).alt || '';
      const alt = language ? `${rawAlt}` : rawAlt;
      const imageId = await uploadMedia(payloadClient, alt || 'content-image', asset, options);

      if (imageId) {
        children.push({
          type: 'upload',
          relationTo: 'media',
          value: imageId,
          format: '',
          indent: 0,
          version: 2,
          fields: {},
        });
      }
    }
  }

  if (children.length === 0) return EMPTY_LEXICAL;

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      direction: 'ltr',
      version: 1,
      children,
    },
  };
};

const mapSeo = async (
  payloadClient: any,
  seo: SanitySeo | null | undefined,
  options: MigrationOptions,
): Promise<Record<string, unknown> | undefined> => {
  if (!seo) return undefined;

  const ogId = await uploadMedia(payloadClient, 'seo-og-image', seo.og_image?.asset ?? null, options);

  const value = removeUndefined({
    overall_ui: seo.overall_ui ?? undefined,
    title: seo.title ?? undefined,
    meta_description: seo.meta_description ?? undefined,
    og_image: ogId ?? undefined,
    no_index: seo.no_index === true ? true : undefined,
    no_follow: seo.no_follow === true ? true : undefined,
    focus_keyphrase: seo.focus_keyphrase ?? undefined,
    additional_fields: seo.additional_fields ?? undefined,
  });

  return Object.keys(value).length ? value : undefined;
};

const mapTranslation = async (
  payloadClient: any,
  translation: SanityTranslation,
  options: MigrationOptions,
): Promise<Record<string, unknown> | null> => {
  const language = normalizeLanguage((translation as { language?: string | null }).language ?? null);
  if (!language) {
    const identifier = (translation as { _key?: string })._key ?? translation.name ?? 'unknown';
    console.warn(`Skipping translation without supported language (${identifier})`);
    return null;
  }

  const contentWithLang = await portableTextToLexical(translation.content ?? [], payloadClient, options, language);
  const seo = await mapSeo(payloadClient, translation.seo, options);

  const langLabels: Record<string, string> = { ru: 'RU', ua: 'UA', en: 'EN' };
  const translationName = translation.name || `Translation ${langLabels[language] || language.toUpperCase()}`;

  return removeUndefined({
    language,
    name: translationName,
    slug: typeof translation.slug === 'string' ? translation.slug : translation.slug?.current ?? undefined,
    summary: translation.summary ?? undefined,
    content: contentWithLang,
    seo,
  });
};

const mapReferenceIds = (
  refs: SanityReference[] | null | undefined,
  sanityToPayload: Map<string, string>,
): string[] => {
  if (!refs?.length) return [];
  return refs
    .map((ref) => sanityToPayload.get(ref._ref))
    .filter((id): id is string => Boolean(id));
};

const ensureSanityIds = (refs?: SanityReference[] | null): string[] =>
  refs?.map((ref) => ref?._ref).filter((id): id is string => Boolean(id)) ?? [];

const initPayload = async () => {
  await payload.init({
    config: payloadConfig as any,
    local: true,
  } as any);

  return payload as any;
};

const upsertByField = async (
  payloadClient: any,
  collection: PayloadCollection,
  key: { field: string; value: string },
  data: Record<string, unknown>,
  options: MigrationOptions,
): Promise<{ id: string; created: boolean } | null> => {
  if (options.dryRun) {
    console.info(`[DRY RUN] ${collection} upsert where ${key.field}=${key.value}`);
    return null;
  }

  const existing = await payloadClient.find({
    collection: collection as any,
    where: {
      [key.field]: {
        equals: key.value,
      },
    },
    limit: 1,
  });

  if (existing.docs.length > 0) {
    const updated = await payloadClient.update({ collection: collection as any, id: existing.docs[0].id as string, data });
    return { id: updated.id as string, created: false };
  }

  const created = await payloadClient.create({ collection: collection as any, data });
  return { id: created.id as string, created: true };
};

// ----------------------------------------
// Ingest helpers
// ----------------------------------------

const ingestCertificates = async (
  payloadClient: any,
  certificates: SanityCertificate[],
  sanityToPayload: Map<string, string>,
  options: MigrationOptions,
): Promise<Counts> => {
  const counts: Counts = { created: 0, updated: 0 };

  for (const certificate of certificates) {
    const imageId = await uploadMedia(payloadClient, `certificate-${certificate.slug.current}`, certificate.image?.asset ?? null, options);
    const description = await portableTextToLexical(certificate.description ?? [], payloadClient, options);

    const translations = certificate.translations
      ? await Promise.all(
          certificate.translations.map(async (translation) =>
            removeUndefined({
              language: translation.language,
              title: translation.title ?? undefined,
              description: await portableTextToLexical(translation.description ?? [], payloadClient, options),
            }),
          ),
        )
      : [];

    const seo = await mapSeo(payloadClient, certificate.seo, options);

    const data = removeUndefined({
      title: certificate.title,
      slug: certificate.slug.current,
      image: imageId ?? undefined,
      description,
      issuer: certificate.issuer ?? undefined,
      issuedDate: certificate.issued_date ?? undefined,
      expiryDate: certificate.expiry_date ?? undefined,
      translations: translations.length ? translations : undefined,
      seo,
    });

    const result = await upsertByField(payloadClient, 'certificates', { field: 'slug', value: certificate.slug.current }, data, options);

    if (result) {
      sanityToPayload.set(certificate._id, result.id);
      counts[result.created ? 'created' : 'updated'] += 1;
    }
  }

  return counts;
};

const ingestTrainings = async (
  payloadClient: any,
  trainings: SanityTraining[],
  sanityToPayload: Map<string, string>,
  options: MigrationOptions,
): Promise<Counts> => {
  const counts: Counts = { created: 0, updated: 0 };

  for (const training of trainings) {
    const translationsRaw = training.translations
      ? await Promise.all(training.translations.map((translation) => mapTranslation(payloadClient, translation, options)))
      : [];
    const translations = translationsRaw.filter(Boolean) as Record<string, unknown>[];

    const seo = await mapSeo(payloadClient, training.seo, options);

    const data = removeUndefined({
      name: training.name,
      slug: training.slug.current,
      translations: translations.length ? translations : undefined,
      seo,
    });

    const result = await upsertByField(payloadClient, 'trainings', { field: 'slug', value: training.slug.current }, data, options);

    if (result) {
      sanityToPayload.set(training._id, result.id);
      counts[result.created ? 'created' : 'updated'] += 1;
    }
  }

  return counts;
};

const ingestTags = async (
  payloadClient: any,
  tags: SanityTag[],
  sanityToPayload: Map<string, string>,
  pending: PendingRelations,
  options: MigrationOptions,
): Promise<Counts> => {
  const counts: Counts = { created: 0, updated: 0 };

  for (const tag of tags) {
    try {
      const imageId = await uploadMedia(payloadClient, `tag-${tag.slug.current}`, tag.image?.asset ?? null, options);
      const content = await portableTextToLexical(tag.content ?? [], payloadClient, options);
      const translationsRaw = tag.translations
        ? await Promise.all(tag.translations.map((translation) => mapTranslation(payloadClient, translation, options)))
        : [];
      const translations = translationsRaw.filter(Boolean) as Record<string, unknown>[];
      const seo = await mapSeo(payloadClient, tag.seo, options);

      const data = removeUndefined({
        name: tag.name,
        slug: tag.slug.current,
        image: imageId ?? undefined,
        summary: tag.summary ?? undefined,
        content,
        descriptionForAI: tag.description_for_ai ?? undefined,
        posts: [],
        faqs: [],
        translations: translations.length ? translations : undefined,
        seo,
      });

      const result = await upsertByField(payloadClient, 'tags', { field: 'slug', value: tag.slug.current }, data, options);

      if (result) {
        sanityToPayload.set(tag._id, result.id);
        const sanityPostIds = ensureSanityIds(tag.posts);
        if (sanityPostIds.length) pending.tagPosts.set(result.id, sanityPostIds);
        const sanityFaqIds = ensureSanityIds(tag.faqs);
        if (sanityFaqIds.length) pending.tagFaqs.set(result.id, sanityFaqIds);
        counts[result.created ? 'created' : 'updated'] += 1;
      }
    } catch (error) {
      console.error(`Failed to ingest tag ${tag.slug.current}:`, (error as Error).message);
      if ((error as any).data?.errors) {
        console.error('Validation errors:', JSON.stringify((error as any).data.errors, null, 2));
      }
    }
  }

  return counts;
};

const ingestFaqs = async (
  payloadClient: any,
  faqs: SanityFaq[],
  sanityToPayload: Map<string, string>,
  pending: PendingRelations,
  options: MigrationOptions,
): Promise<Counts> => {
  const counts: Counts = { created: 0, updated: 0 };

  for (const faq of faqs) {
    const answer = await portableTextToLexical(faq.answer ?? [], payloadClient, options);
    const translationsRaw = faq.translations
      ? await Promise.all(faq.translations.map((translation) => mapTranslation(payloadClient, translation, options)))
      : [];
    const translations = translationsRaw.filter(Boolean) as Record<string, unknown>[];
    const seo = await mapSeo(payloadClient, faq.seo, options);

    const data = removeUndefined({
      question: faq.question,
      answer,
      tags: mapReferenceIds(faq.tags, sanityToPayload),
      posts: [],
      translations: translations.length ? translations : undefined,
      seo,
    });

    const result = await upsertByField(payloadClient, 'faqs', { field: 'question', value: faq.question }, data, options);

    if (result) {
      sanityToPayload.set(faq._id, result.id);
      const sanityPostIds = ensureSanityIds(faq.posts);
      if (sanityPostIds.length) pending.faqPosts.set(result.id, sanityPostIds);
      counts[result.created ? 'created' : 'updated'] += 1;
    }
  }

  return counts;
};

const ingestTeam = async (
  payloadClient: any,
  teamMembers: SanityTeamMember[],
  sanityToPayload: Map<string, string>,
  pending: PendingRelations,
  options: MigrationOptions,
): Promise<Counts> => {
  const counts: Counts = { created: 0, updated: 0 };

  for (const member of teamMembers) {
    const photoId = await uploadMedia(payloadClient, `team-${member._id}`, member.photo?.asset ?? null, options);
    const bio = await portableTextToLexical(member.bio ?? [], payloadClient, options);
    const translationsRaw = member.translations
      ? await Promise.all(member.translations.map((translation) => mapTranslation(payloadClient, translation, options)))
      : [];
    const translations = translationsRaw.filter(Boolean) as Record<string, unknown>[];
    const seo = await mapSeo(payloadClient, member.seo, options);

    const data = removeUndefined({
      name: member.name,
      slug: typeof member.slug === 'string' ? member.slug : member.slug?.current ?? undefined,
      position: member.position ?? undefined,
      bioSummary: member.bio_summary ?? undefined,
      bio,
      photo: photoId ?? undefined,
      email: member.email ?? undefined,
      links:
        member.links?.map((link) => removeUndefined({ service: link.service ?? undefined, url: link.link ?? undefined })) ?? [],
      certificates: mapReferenceIds(member.certificates, sanityToPayload),
      trainings: mapReferenceIds(member.trainings, sanityToPayload),
      faqs: mapReferenceIds(member.faqs, sanityToPayload),
      posts: [],
      translations: translations.length ? translations : undefined,
      seo,
    });

    const result = await upsertByField(payloadClient, 'team', { field: 'name', value: member.name }, data, options);

    if (result) {
      sanityToPayload.set(member._id, result.id);
      const sanityPostIds = ensureSanityIds(member.posts);
      if (sanityPostIds.length) pending.teamPosts.set(result.id, sanityPostIds);
      counts[result.created ? 'created' : 'updated'] += 1;
    }
  }

  return counts;
};

const ingestPosts = async (
  payloadClient: any,
  posts: SanityPost[],
  sanityToPayload: Map<string, string>,
  pending: PendingRelations,
  options: MigrationOptions,
): Promise<Counts> => {
  const counts: Counts = { created: 0, updated: 0 };

  for (const post of posts) {
    const [imageId, thumbnailId, image16x9Id, image5x4Id] = await Promise.all([
      uploadMedia(payloadClient, `post-${post.slug.current}`, post.image?.asset ?? null, options),
      uploadMedia(payloadClient, `post-thumbnail-${post.slug.current}`, post.social_images?.thumbnail?.asset ?? null, options),
      uploadMedia(payloadClient, `post-16x9-${post.slug.current}`, post.social_images?.image_16x9?.asset ?? null, options),
      uploadMedia(payloadClient, `post-5x4-${post.slug.current}`, post.social_images?.image_5x4?.asset ?? null, options),
    ]);

    const content = await portableTextToLexical(post.content ?? [], payloadClient, options);
    const translationsRaw = post.translations
      ? await Promise.all(post.translations.map((translation) => mapTranslation(payloadClient, translation, options)))
      : [];
    const translations = translationsRaw.filter(Boolean) as Record<string, unknown>[];

    const seo = await mapSeo(payloadClient, post.seo, options);

    const socialImages = removeUndefined({
      thumbnail: thumbnailId ?? undefined,
      image16x9: image16x9Id ?? undefined,
      image5x4: image5x4Id ?? undefined,
    });

    const authorRef = typeof post.author === 'string' ? post.author : (post.author as any)?._ref;
    const authorId = authorRef ? sanityToPayload.get(authorRef) : undefined;
    
    const tagRefs = Array.isArray(post.tags) ? post.tags.map(t => typeof t === 'string' ? t : (t as any)?._ref).filter(Boolean) : [];
    const tagIds = tagRefs.map(ref => sanityToPayload.get(ref)).filter((id): id is string => Boolean(id));
    
    const faqRefs = Array.isArray(post.faqs) ? post.faqs.map(f => typeof f === 'string' ? f : (f as any)?._ref).filter(Boolean) : [];
    const faqIds = faqRefs.map(ref => sanityToPayload.get(ref)).filter((id): id is string => Boolean(id));

    const data = removeUndefined({
      name: post.name,
      slug: post.slug.current,
      author: authorId ? { relationTo: 'team', value: authorId } : undefined,
      image: imageId ?? undefined,
      summary: post.summary ?? undefined,
      socialImages: Object.keys(socialImages).length ? socialImages : undefined,
      content,
      tags: tagIds.length ? tagIds.map(id => ({ relationTo: 'tags', value: id })) : undefined,
      faqs: faqIds.length ? faqIds.map(id => ({ relationTo: 'faqs', value: id })) : undefined,
      translations: translations.length ? translations : undefined,
      seo,
      featured: post.featured ?? undefined,
      publishedAt: post.publishedAt ?? undefined,
    });

    console.log(`Post ${post.slug.current}: author=${authorId}, tags=${tagIds.length}, faqs=${faqIds.length}`);

    const result = await upsertByField(payloadClient, 'posts', { field: 'slug', value: post.slug.current }, data, options);

    if (result) {
      sanityToPayload.set(post._id, result.id);
      counts[result.created ? 'created' : 'updated'] += 1;
    }
  }

  return counts;
};

const ingestRedirects = async (
  payloadClient: any,
  redirects: SanityRedirect[],
  options: MigrationOptions,
): Promise<Counts> => {
  const counts: Counts = { created: 0, updated: 0 };

  for (const redirect of redirects) {
    try {
      const data = removeUndefined({
        fromPath: redirect.from_path,
        toPath: redirect.to_path,
        statusCode: redirect.status_code ?? 301,
      });

      const result = await upsertByField(payloadClient, 'redirects', { field: 'fromPath', value: redirect.from_path }, data, options);

      if (result) {
        counts[result.created ? 'created' : 'updated'] += 1;
      }
    } catch (error) {
      console.warn(`Failed to ingest redirect ${redirect.from_path}:`, (error as Error).message);
    }
  }

  return counts;
};

const ingestGlobals = async (
  payloadClient: any,
  globals: SanityGlobals | null,
  options: MigrationOptions,
): Promise<{ updated: number }> => {
  if (!globals) return { updated: 0 };

  const [faviconId, logoId, logoDarkId] = await Promise.all([
    uploadMedia(payloadClient, 'globals-favicon', globals.favicon?.asset ?? null, options),
    uploadMedia(payloadClient, 'globals-logo', globals.logo?.asset ?? null, options),
    uploadMedia(payloadClient, 'globals-logo-dark', globals.logo_dark_mode?.asset ?? null, options),
  ]);

  const data = removeUndefined({
    title: globals.title ?? undefined,
    tagline: globals.tagline ?? undefined,
    description: globals.description ?? undefined,
    url: globals.url ?? undefined,
    favicon: faviconId ?? undefined,
    logo: logoId ?? undefined,
    logoDarkMode: logoDarkId ?? undefined,
    accentColor: globals.accent_color ?? undefined,
    socialLinks:
      globals.social_links
        ?.filter((link) => link?.service && link?.url)
        .map((link) => ({ service: link!.service!, url: link!.url! })) ?? [],
  });

  if (options.dryRun) {
    console.info('[DRY RUN] Update SiteGlobals global');
    return { updated: 0 };
  }

  await payloadClient.updateGlobal({ slug: 'site-globals', data: data as Record<string, unknown> });
  return { updated: 1 };
};

const resolvePendingRelations = async (
  payloadClient: any,
  sanityToPayload: Map<string, string>,
  pending: PendingRelations,
) => {
  const updateEntries = async (collection: PayloadCollection, entries: Map<string, string[]>, field: string) => {
    for (const [payloadId, sanityIds] of entries) {
      const resolved = sanityIds.map((id) => sanityToPayload.get(id)).filter((id): id is string => Boolean(id));
      if (resolved.length === 0) continue;

      try {
        await payloadClient.update({
          collection,
          id: payloadId,
          data: { [field]: resolved },
        });
      } catch (error) {
        console.warn(`Failed to update ${collection}/${payloadId} ${field}:`, (error as Error).message);
      }
    }
  };

  console.log('Resolving pending relations...');
  await updateEntries('tags', pending.tagFaqs, 'faqs');
  await updateEntries('tags', pending.tagPosts, 'posts');
  await updateEntries('faqs', pending.faqPosts, 'posts');
  await updateEntries('team', pending.teamPosts, 'posts');
  console.log('Pending relations resolved.');
};

// ----------------------------------------
// Fetch data
// ----------------------------------------

const fetchSanityDocuments = async () => {
  const [certificates, trainings, tags, faqs, team, posts, redirects, globalsDoc] = await Promise.all([
    sanity.fetch<SanityCertificate[]>(
      `*[_type == "certificate"]{
        _id,
        title,
        slug,
        description,
        image,
        issuer,
        issued_date,
        expiry_date,
        translations[]{language, title, description},
        seo
      }`,
    ),
    sanity.fetch<SanityTraining[]>(
      `*[_type == "training"]{
        _id,
        name,
        slug,
        translations,
        seo
      }`,
    ),
    sanity.fetch<SanityTag[]>(
      `*[_type == "tag"]{
        _id,
        name,
        slug,
        image,
        summary,
        content,
        description_for_ai,
        posts[]->{_id},
        faqs[]->{_id},
        translations,
        seo
      }`,
    ),
    sanity.fetch<SanityFaq[]>(
      `*[_type == "faq"]{
        _id,
        question,
        answer,
        tags[]->{_id},
        posts[]->{_id},
        translations,
        seo
      }`,
    ),
    sanity.fetch<SanityTeamMember[]>(
      `*[_type == "team"]{
        _id,
        name,
        slug,
        position,
        bio,
        bio_summary,
        photo,
        email,
        links,
        posts[]->{_id},
        certificates[]->{_id},
        trainings[]->{_id},
        faqs[]->{_id},
        translations,
        seo
      }`,
    ),
    sanity.fetch<SanityPost[]>(
      `*[_type == "post"]{
        _id,
        name,
        slug,
        "author": author._ref,
        image,
        summary,
        social_images,
        content,
        "tags": tags[]._ref,
        "faqs": faqs[]._ref,
        translations,
        seo,
        featured,
        publishedAt
      }`,
    ),
    sanity.fetch<SanityRedirect[]>(`*[_type == "redirect"]{ from_path, to_path, status_code, created_at }`),
    sanity.fetch<SanityGlobals | null>(
      `*[_type == "globals"]{
        title,
        tagline,
        description,
        url,
        favicon,
        logo,
        logo_dark_mode,
        accent_color,
        social_links
      }[0]`,
    ),
  ]);

  return { certificates, trainings, tags, faqs, team, posts, redirects, globalsDoc };
};

// ----------------------------------------
// Main
// ----------------------------------------

const parseArgs = (): MigrationOptions => {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    skipMedia: args.includes('--skip-media'),
  };
};

const main = async () => {
  const options = parseArgs();
  console.log(`Sanity → Payload migration started. Options: dryRun=${options.dryRun}, skipMedia=${options.skipMedia}`);

  const payloadClient = await initPayload();
  const sanityToPayload = new Map<string, string>();
  const pending: PendingRelations = {
    tagPosts: new Map(),
    tagFaqs: new Map(),
    faqPosts: new Map(),
    teamPosts: new Map(),
  };

  const { certificates, trainings, tags, faqs, team, posts, redirects, globalsDoc } = await fetchSanityDocuments();

  console.log(
    `Fetched from Sanity: certificates=${certificates.length}, trainings=${trainings.length}, tags=${tags.length}, faqs=${faqs.length}, team=${team.length}, posts=${posts.length}, redirects=${redirects.length}, globals=${globalsDoc ? 1 : 0}`,
  );

  const results = {
    certificates: await ingestCertificates(payloadClient, certificates, sanityToPayload, options),
    trainings: await ingestTrainings(payloadClient, trainings, sanityToPayload, options),
    tags: await ingestTags(payloadClient, tags, sanityToPayload, pending, options),
    faqs: await ingestFaqs(payloadClient, faqs, sanityToPayload, pending, options),
    team: await ingestTeam(payloadClient, team, sanityToPayload, pending, options),
    posts: await ingestPosts(payloadClient, posts, sanityToPayload, pending, options),
    globals: await ingestGlobals(payloadClient, globalsDoc, options),
    redirects: await ingestRedirects(payloadClient, redirects, options),
  };

  console.log('\\n=== Sanity to Payload ID mapping ===');
  console.log(`Total mappings: ${sanityToPayload.size}`);
  for (const [sanityId, payloadId] of sanityToPayload) {
    if (sanityId.startsWith('team-')) {
      console.log(`Team: ${sanityId} → ${payloadId}`);
    }
  }

  if (!options.dryRun) {
    await resolvePendingRelations(payloadClient, sanityToPayload, pending);
  }

  console.log('Migration summary:');
  console.log(JSON.stringify(results, null, 2));
  console.log('Sanity → Payload migration finished.');
};

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
