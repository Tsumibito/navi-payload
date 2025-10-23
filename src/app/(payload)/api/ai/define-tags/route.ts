import { NextRequest, NextResponse } from 'next/server';
import config from '@payload-config';
import { getPayload } from 'payload';

import { extractTextFromLexical } from '@/utils/lexicalLinkAnalysis';

const POSTS_COLLECTION = 'posts-new';
const TAGS_COLLECTION = 'tags-new';
const TAG_RELATION = 'tags-new';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const POST_RELATION = 'posts-new';

const DEFAULT_MODEL = process.env.DEFINE_TAGS_MODEL ?? 'openai/gpt-4o-mini';
const DEFAULT_TEMPERATURE = clampToRange(parseFloat(process.env.DEFINE_TAGS_TEMPERATURE ?? '0.2'), 0, 1, 0.2);
const DEFAULT_MAX_TOKENS = parseIntSafe(process.env.DEFINE_TAGS_MAX_TOKENS, 2000);

type PayloadClient = {
  findByID: (args: Record<string, unknown>) => Promise<unknown>;
  find: (args: Record<string, unknown>) => Promise<unknown>;
  update: (args: Record<string, unknown>) => Promise<unknown>;
};

type PostRecord = {
  id: string | number;
  name?: unknown;
  summary?: unknown;
  content?: unknown;
  tags?: unknown;
};

type RawTagRecord = {
  id: string | number;
  name?: unknown;
  summary?: unknown;
  descriptionForAI?: unknown;
  content?: unknown;
  posts?: unknown;
};

type TagRecord = {
  id: string;
  name?: unknown;
  summary?: unknown;
  descriptionForAI?: unknown;
  content?: unknown;
  posts?: unknown;
};

type SelectedTagSummary = {
  id: string;
  label?: string | null;
};

function normalizeId(input: unknown, depth = 0): string | null {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed || null;
  }

  if (typeof input === 'number') {
    return String(input);
  }

  if (!input || typeof input !== 'object') {
    return null;
  }

  if (depth > 4) {
    return null;
  }

  const container = input as { id?: unknown; value?: unknown };
  if ('id' in container && container.id !== undefined) {
    return normalizeId(container.id, depth + 1);
  }
  if ('value' in container && container.value !== undefined) {
    return normalizeId(container.value, depth + 1);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const postId = typeof body?.postId === 'string' ? body.postId : undefined;

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    const token = process.env.OPENROUTER_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'OPENROUTER_TOKEN not configured' }, { status: 500 });
    }

    const payload = await getPayload({ config });
    const payloadClient = payload as unknown as PayloadClient;

    const post = (await payloadClient.findByID({
      collection: POSTS_COLLECTION,
      id: postId,
      depth: 0,
    })) as PostRecord | null;

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const tagsQuery = (await payloadClient.find({
      collection: TAGS_COLLECTION,
      depth: 0,
      limit: 1000,
    })) as { docs?: unknown } | null;

    const rawTags = Array.isArray(tagsQuery?.docs)
      ? (tagsQuery?.docs as RawTagRecord[])
      : [];

    const tags: TagRecord[] = [];
    for (const rawTag of rawTags) {
      if (!rawTag) {
        continue;
      }

      const normalized = normalizeId(rawTag.id);
      if (!normalized) {
        continue;
      }

      tags.push({
        id: normalized,
        name: rawTag.name,
        summary: rawTag.summary,
        descriptionForAI: rawTag.descriptionForAI,
        content: rawTag.content,
        posts: rawTag.posts,
      });
    }

    if (!tags.length) {
      return NextResponse.json({ error: 'No tags found' }, { status: 400 });
    }

    const tagsById = new Map<string, TagRecord>();
    for (const tag of tags) {
      if (!tag) continue;
      tagsById.set(String(tag.id), tag);
    }

    const postContext = buildPostContext(post);
    const tagContexts = tags.map((tag) =>
      buildTagContext({
        id: String(tag.id),
        name: tag.name,
        summary: tag.summary,
        descriptionForAI: tag.descriptionForAI,
        content: tag.content,
        posts: tag.posts,
      }),
    );

    const aiScores = await fetchScores({
      token,
      model: DEFAULT_MODEL,
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,
      postContext,
      tags: tagContexts,
    });

    const merged = mergeScores(tags.map((tag) => ({ id: tag.id })), aiScores);
    const selectedTagIds = pickTagIds(merged);
    const selectedTagRecords = selectedTagIds
      .map((id) => tagsById.get(String(id)))
      .filter((tag): tag is TagRecord => Boolean(tag));

    const selectedTagSummaries: SelectedTagSummary[] = [];
    for (const tagRecord of selectedTagRecords) {
      const stringId = tagRecord.id;
      if (!stringId) {
        continue;
      }

      const label = extractLocalizedString(tagRecord.name) || undefined;
      selectedTagSummaries.push({
        id: stringId,
        label,
      });
    }

    if (!selectedTagSummaries.length) {
      return NextResponse.json({
        success: true,
        tagIds: [],
        totalTags: tags.length,
        selectedCount: 0,
        skipped: 'No tags passed validation',
      });
    }

    const newTagsPayload = selectedTagSummaries.map((tag) => ({
      relationTo: TAG_RELATION,
      value: parseInt(tag.id, 10),
    }));

    // Merge: добавляем новые теги к существующим, избегая дубликатов
    const existingTags = Array.isArray(post.tags) ? post.tags : [];
    const existingIds = new Set(
      existingTags.map((tag: unknown) => {
        const val = typeof tag === 'object' && tag !== null && 'value' in tag ? (tag as { value: unknown }).value : tag;
        return String(val);
      })
    );
    
    const uniqueNewTags = newTagsPayload.filter(
      (tag) => !existingIds.has(String(tag.value))
    );
    
    const mergedTags = [...existingTags, ...uniqueNewTags];

    await payloadClient.update({
      collection: POSTS_COLLECTION,
      id: postId,
      data: {
        tags: mergedTags,
      },
    });

    await syncTagBackRefs({
      payload: payloadClient,
      postId,
      tags: tags.map((tag) => ({ id: tag.id, posts: tag.posts, label: extractLocalizedString(tag.name) })),
      selectedTagIds: selectedTagSummaries.map((tag) => tag.id),
    });

    return NextResponse.json({
      success: true,
      tagIds: selectedTagSummaries.map((tag) => tag.id),
      totalTags: tags.length,
      selectedCount: selectedTagSummaries.length,
      selectedTags: selectedTagSummaries,
      addedCount: uniqueNewTags.length,
      totalCount: mergedTags.length,
    });
  } catch (error) {
    console.error('[define-tags] Error:', error);
    if (error && typeof error === 'object' && 'cause' in error) {
      console.error('[define-tags] Cause:', (error as { cause?: unknown }).cause);
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}

type PostContext = {
  title?: string;
  summary?: string;
  content?: string;
};

type TagContext = {
  tagId: string;
  title?: string;
  summary?: string;
  description?: string;
  content?: string;
  existingLink?: boolean;
};

type ScoreItem = {
  tagId: string;
  score: number;
};

type ScoreResponse = {
  scores: ScoreItem[];
};

function buildPostContext(post: { name?: unknown; summary?: unknown; content?: unknown }): PostContext {
  return {
    title: cleanString(post?.name),
    summary: truncate(cleanString(post?.summary), 600),
    content: truncate(cleanRichText(post?.content), 5000),
  };
}

function buildTagContext(tag: {
  id: string;
  name?: unknown;
  summary?: unknown;
  descriptionForAI?: unknown;
  content?: unknown;
  posts?: unknown;
}): TagContext {
  return {
    tagId: String(tag.id),
    title: cleanString(tag.name),
    summary: truncate(cleanString(tag.summary), 600),
    description: truncate(cleanString(tag.descriptionForAI), 600),
    content: truncate(cleanRichText(tag.content), 600),
    existingLink: hasExistingLink(tag.posts),
  };
}

function hasExistingLink(value: unknown) {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.some((item) => Boolean(normalizeRelationEntry(item)?.value));
}

function truncate(value: string, max: number) {
  if (!value) {
    return value;
  }
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function cleanString(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
}

function cleanRichText(value: unknown) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return cleanString(value);
  }
  return cleanString(extractTextFromLexical(value));
}

function extractLocalizedString(value: unknown) {
  if (typeof value === 'string') {
    return cleanString(value);
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const record = value as Record<string, unknown>;
  const locales = ['ru', 'uk', 'ua', 'en'];

  for (const locale of locales) {
    const entry = record[locale];
    if (typeof entry === 'string' && entry.trim()) {
      return cleanString(entry);
    }
  }

  for (const entry of Object.values(record)) {
    if (typeof entry === 'string' && entry.trim()) {
      return cleanString(entry);
    }
  }

  return '';
}

async function fetchScores(params: {
  token: string;
  model: string;
  temperature: number;
  maxTokens: number;
  postContext: PostContext;
  tags: TagContext[];
}): Promise<ScoreItem[]> {
  const { token, model, temperature, maxTokens, postContext, tags } = params;

  const body = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'system',
        content:
          'Score relevance of each tag to the provided post context. Return JSON: {"scores":[{"tagId":"id","score":int}]} with integer scores 1-100, every tag exactly once.',
      },
      {
        role: 'user',
        content: JSON.stringify({ post: postContext, tags }),
      },
    ],
  };

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'HTTP-Referer': 'https://navi.training',
      'X-Title': 'Navi Training Define Tags',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter error ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Empty completion');
  }

  const parsed = parseScoreJson(content);
  if (!parsed?.scores || !Array.isArray(parsed.scores) || !parsed.scores.length) {
    throw new Error('Invalid scores payload');
  }

  return parsed.scores.map((item) => ({
    tagId: String(item.tagId ?? ''),
    score: clampScore(Number(item.score)),
  }));
}

function parseScoreJson(text: string): ScoreResponse {
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw error;
    }
    return JSON.parse(match[0]);
  }
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 1) {
    return 1;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

function mergeScores(tags: Array<{ id: string }>, scores: ScoreItem[]) {
  const map = new Map<string, number>();
  for (const score of scores) {
    if (score.tagId) {
      map.set(score.tagId, score.score);
    }
  }
  return tags.map((tag) => ({
    tagId: String(tag.id),
    score: map.get(String(tag.id)) ?? 0,
  }));
}

function pickTagIds(scores: ScoreItem[]) {
  if (!scores.length) {
    return [] as string[];
  }

  const total = scores.length;
  const minCount = Math.max(1, Math.ceil(total * 0.15));
  const maxCount = Math.max(minCount, Math.floor(total * 0.3));

  const sorted = [...scores].sort((a, b) => {
    if (b.score === a.score) {
      return a.tagId.localeCompare(b.tagId);
    }
    return b.score - a.score;
  });

  const selected = sorted.slice(0, maxCount);
  if (selected.length < minCount) {
    return sorted.slice(0, minCount).map((item) => item.tagId);
  }

  const thresholdScore = selected[selected.length - 1]?.score ?? 0;
  const candidates = sorted.filter((item) => item.score >= thresholdScore);

  return candidates.slice(0, maxCount).map((item) => item.tagId);
}

async function syncTagBackRefs(params: {
  payload: PayloadClient;
  postId: string;
  tags: Array<{
    id: string;
    posts?: unknown;
  }>;
  selectedTagIds: string[];
}) {
  const { payload, postId, tags, selectedTagIds } = params;
  const selected = new Set(selectedTagIds.map((id) => String(id)));

  await Promise.all(
    tags.map(async (tag) => {
      const tagId = String(tag.id);
      const shouldLink = selected.has(tagId);
      const relationListRaw = Array.isArray(tag.posts) ? tag.posts : [];
      const normalizedRelations = relationListRaw
        .map((relation) => normalizeRelationEntry(relation))
        .filter((entry): entry is RelationEntry => Boolean(entry));

      const currentEntries = dedupeRelationEntries(normalizedRelations);
      const withoutCurrentPost = currentEntries.filter((entry) => {
        return entry.value !== postId;
      });

      const targetEntries = shouldLink
        ? dedupeRelationEntries([...withoutCurrentPost, { relationTo: POST_RELATION, value: postId }])
        : withoutCurrentPost;

      if (sameRelationEntries(currentEntries, targetEntries)) {
        return;
      }

      console.log('[define-tags] updating tag posts', {
        tagId,
        shouldLink,
        currentEntries,
        targetEntries,
      });

      try {
        await updateWithRetry(payload, {
          collection: TAGS_COLLECTION,
          id: tagId,
          data: {
            posts: targetEntries.map((entry) => parseInt(entry.value, 10)),
          },
        });
      } catch (error) {
        console.warn('[define-tags] skipped tag back-ref sync', {
          tagId,
          shouldLink,
          error,
        });
      }
    }),
  );
}

type RelationEntry = { relationTo: string; value: string };

function normalizeRelationEntry(relation: unknown): RelationEntry | null {
  if (typeof relation === 'string' || typeof relation === 'number') {
    return buildRelationEntry(String(relation));
  }

  if (!relation || typeof relation !== 'object') {
    return null;
  }

  const { relationTo, value, id } = relation as {
    relationTo?: unknown;
    value?: unknown;
    id?: unknown;
  };

  if (typeof value === 'string' || typeof value === 'number') {
    return buildRelationEntry(String(value), relationTo);
  }

  if (typeof id === 'string' || typeof id === 'number') {
    return buildRelationEntry(String(id), relationTo);
  }

  return null;
}

function buildRelationEntry(raw: string, relationTo?: unknown): RelationEntry | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '0' || trimmed === 'null' || trimmed === 'undefined') {
    return null;
  }

  return {
    relationTo: typeof relationTo === 'string' && relationTo.length > 0 ? relationTo : POST_RELATION,
    value: trimmed,
  };
}

async function updateWithRetry(
  payload: PayloadClient,
  args: { collection: string; id: string; data: Record<string, unknown> },
  attempt = 1,
) {
  try {
    await payload.update(args);
  } catch (error) {
    console.error('[define-tags] updateWithRetry error', {
      args,
      attempt,
      error,
      cause: (error as { cause?: unknown })?.cause,
    });
    if (attempt >= 2) {
      throw error;
    }
    console.warn('[define-tags] retrying tag update', { id: args.id, attempt, error });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await updateWithRetry(payload, args, attempt + 1);
  }
}

function dedupeRelationEntries(list: RelationEntry[]) {
  const seen = new Set<string>();
  const result: RelationEntry[] = [];
  for (const item of list) {
    const key = `${item.relationTo}:${item.value}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function sameRelationEntries(a: RelationEntry[], b: RelationEntry[]) {
  if (a.length !== b.length) {
    return false;
  }

  const map = new Map<string, number>();
  for (const item of a) {
    const key = `${item.relationTo}:${item.value}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  for (const item of b) {
    const key = `${item.relationTo}:${item.value}`;
    const next = (map.get(key) ?? 0) - 1;
    if (next < 0) {
      return false;
    }
    if (next === 0) {
      map.delete(key);
    } else {
      map.set(key, next);
    }
  }

  return map.size === 0;
}

function clampToRange(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function parseIntSafe(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
