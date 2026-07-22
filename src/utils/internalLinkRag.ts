import { createHash } from 'node:crypto'

import type { ContentLocale } from '../config/contentLocales'

type LexicalNode = {
  type?: string
  text?: string
  url?: string
  fields?: { url?: string; [key: string]: unknown }
  children?: LexicalNode[]
  [key: string]: unknown
}

export type ExistingPassageLink = { anchor: string; url: string }

export type LinkPassage = {
  nodePath: string
  nodeType: string
  heading?: string
  content: string
  contentHash: string
  existingLinks: ExistingPassageLink[]
}

export type RelatedPassage = LinkPassage & {
  postId: number
  title: string
  slug: string
  semanticScore: number
  hybridScore: number
  sourceLinkCount: number
  targetInboundCount: number
}

export type LinkSuggestion = {
  sourcePostId: number
  sourceNodePath: string
  sourceContentHash: string
  anchor: string
  url: string
  targetPostId?: number
  reason?: string
  relevanceScore?: number
}

const EMBEDDING_DIMENSIONS = 1024
const INDEXABLE_NODE_TYPES = new Set(['paragraph', 'heading', 'quote'])

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function textOf(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const value = node as LexicalNode
  if (value.type === 'text') return typeof value.text === 'string' ? value.text : ''
  return Array.isArray(value.children) ? value.children.map(textOf).join('') : ''
}

function linksOf(node: unknown, result: ExistingPassageLink[] = []): ExistingPassageLink[] {
  if (!node || typeof node !== 'object') return result
  const value = node as LexicalNode
  if (value.type === 'link' || value.type === 'autolink') {
    const url = value.fields?.url || value.url
    const anchor = normalizeSpace(textOf(value))
    if (typeof url === 'string' && url.trim() && anchor) result.push({ anchor, url: url.trim() })
  }
  value.children?.forEach((child) => linksOf(child, result))
  return result
}

function hashText(value: string): string {
  return createHash('sha256').update(normalizeSpace(value)).digest('hex')
}

/**
 * Extract semantic blocks without breaking Lexical node boundaries. nodePath is
 * deliberately based on child indexes so a later link insertion can be guarded
 * by the content hash and applied to the exact original block.
 */
export function extractLinkPassages(content: unknown): LinkPassage[] {
  const root = (content as { root?: LexicalNode } | undefined)?.root
  if (!root || !Array.isArray(root.children)) return []
  const passages: LinkPassage[] = []
  let currentHeading = ''

  const visit = (node: LexicalNode, path: number[]) => {
    const nodeType = node.type || 'unknown'
    const hasNestedBlock = (node.children || []).some((child) => INDEXABLE_NODE_TYPES.has(child.type || '') || child.type === 'listitem')
    const indexable = INDEXABLE_NODE_TYPES.has(nodeType) || (nodeType === 'listitem' && !hasNestedBlock)
    if (indexable) {
      const text = normalizeSpace(textOf(node))
      if (nodeType === 'heading' && text) currentHeading = text
      if (text.length >= 45) {
        passages.push({
          nodePath: path.join('.'),
          nodeType,
          heading: nodeType === 'heading' ? text : currentHeading || undefined,
          // A Lexical paragraph is normally short. Cap pathological pasted
          // blocks so batch embeddings and LLM context stay bounded.
          content: text.slice(0, 4_000),
          contentHash: hashText(text),
          existingLinks: linksOf(node),
        })
      }
      return
    }
    node.children?.forEach((child, index) => visit(child, [...path, index]))
  }

  root.children.forEach((node, index) => visit(node, [index]))
  return passages
}

function relationId(value: unknown): string | number | undefined {
  if (value == null) return undefined
  if (typeof value !== 'object') return value as string | number
  const item = value as { id?: string | number; value?: unknown }
  return item.value !== undefined ? relationId(item.value) : item.id
}

function tagIds(post: any): string[] {
  return (post.tags || []).map(relationId).filter((value: unknown) => value != null).map(String)
}

function embeddingModel(): string {
  return process.env.OPENROUTER_EMBEDDING_MODEL?.trim() || 'baai/bge-m3'
}

function parseEmbeddingResponse(body: any): number[][] {
  const raw = body?.data
  if (!Array.isArray(raw)) throw new Error('OpenRouter returned no embedding matrix')
  const ordered = [...raw].sort((left: any, right: any) => (left?.index ?? 0) - (right?.index ?? 0))
  const matrix = ordered.map((item: any) => item?.embedding)
  if (matrix.some((item: unknown) => !Array.isArray(item) || item.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error(`OpenRouter returned an unexpected embedding size; expected ${EMBEDDING_DIMENSIONS}`)
  }
  return matrix as number[][]
}

export async function embedPassages(texts: string[]): Promise<number[][]> {
  if (!texts.length) return []
  const token = process.env.OPENROUTER_TOKEN?.trim()
  if (!token) throw new Error('OPENROUTER_TOKEN is not configured')
  const batches: string[][] = []
  for (let offset = 0; offset < texts.length; offset += 24) batches.push(texts.slice(offset, offset + 24))

  const embedBatch = async (batch: string[]): Promise<number[][]> => {
    const controller = new AbortController()
    let timedOut = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const request = (async () => {
      const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.PAYLOAD_PUBLIC_SERVER_URL?.trim() || 'https://payload.navi.training',
          'X-Title': 'Navi.training internal linking',
        },
        body: JSON.stringify({ model: embeddingModel(), input: batch, encoding_format: 'float' }),
      })
      if (!response.ok) throw new Error(`OpenRouter embeddings ${response.status}: ${(await response.text()).slice(0, 500)}`)
      return parseEmbeddingResponse(await response.json())
    })()
    try {
      return await Promise.race([
        request,
        new Promise<number[][]>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true
            controller.abort()
            reject(new Error(`OpenRouter embeddings timed out for batch of ${batch.length}`))
          }, 20_000)
        }),
      ])
    } catch (error) {
      if (!timedOut || batch.length === 1 || process.env.LINK_INDEX_FAST_FAIL === '1') throw error
      const middle = Math.ceil(batch.length / 2)
      const [left, right] = await Promise.all([embedBatch(batch.slice(0, middle)), embedBatch(batch.slice(middle))])
      return [...left, ...right]
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  // OpenRouter accepts batched inputs. A small concurrency window makes the
  // one-time corpus backfill practical without creating an unbounded burst.
  const output: number[][] = []
  for (let offset = 0; offset < batches.length; offset += 8) {
    const group = await Promise.all(batches.slice(offset, offset + 8).map(embedBatch))
    group.forEach((matrix) => output.push(...matrix))
  }
  return output
}

function vectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value).toFixed(8)).join(',')}]`
}

function rowsOf(result: any): any[] {
  return Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : []
}

function normalizeInternalURL(value: string): string | null {
  try {
    const url = new URL(value, 'https://navi.training')
    if (!['navi.training', 'www.navi.training'].includes(url.hostname)) return null
    return `${url.pathname.replace(/\/+$/, '') || '/'}${url.search}${url.hash}`
  } catch {
    return null
  }
}

async function routeMap(payload: any, locale: ContentLocale): Promise<Map<string, number>> {
  const result = await payload.find({
    collection: 'posts-new', locale, fallbackLocale: false, depth: 0, limit: 0,
    where: { publicationStatus: { equals: 'published' } },
  })
  const prefix = locale === 'uk' ? 'ua' : locale
  const routes = new Map<string, number>()
  for (const post of result.docs as any[]) {
    const slug = post.publicSlug || post.slug
    if (!slug) continue
    routes.set(`/${prefix}/blog/${String(slug).replace(/^\/+|\/+$/g, '')}`, Number(post.id))
  }
  return routes
}

/** Incrementally embeds changed blocks and rebuilds the actual link graph. */
export async function syncPostLinkIndex(payload: any, post: any, locale: ContentLocale): Promise<{ indexed: number; embedded: number; links: number }> {
  const pool = payload.db?.pool
  if (!pool?.query) throw new Error('Payload Postgres pool is unavailable')
  const passages = extractLinkPassages(post.content)
  const model = embeddingModel()
  const existingResult = await pool.query(
    'SELECT node_path, content_hash, embedding_model FROM navi.link_passages WHERE post_id = $1 AND locale = $2',
    [post.id, locale],
  )
  const existing = new Map(rowsOf(existingResult).map((row: any) => [String(row.node_path), { hash: String(row.content_hash), model: String(row.embedding_model) }]))
  const changed = passages.filter((passage) => {
    const cached = existing.get(passage.nodePath)
    return cached?.hash !== passage.contentHash || cached.model !== model
  })
  // A semantic block can contain a very long imported list. BGE-M3 does not
  // need the entire block to identify its topic, and bounding each input keeps
  // batch latency predictable during the initial corpus backfill.
  const embeddings = await embedPassages(changed.map((passage) => passage.content.slice(0, 2_400)))
  const changedEmbedding = new Map(changed.map((passage, index) => [passage.nodePath, embeddings[index]]))
  const tags = tagIds(post)
  const routes = await routeMap(payload, locale)
  const client = await pool.connect()
  let linkCount = 0

  try {
    await client.query('BEGIN')
    const paths = passages.map((passage) => passage.nodePath)
    if (paths.length) {
      await client.query(
        'DELETE FROM navi.link_passages WHERE post_id = $1 AND locale = $2 AND NOT (node_path = ANY($3::text[]))',
        [post.id, locale, paths],
      )
    } else {
      await client.query('DELETE FROM navi.link_passages WHERE post_id = $1 AND locale = $2', [post.id, locale])
    }

    const changedRows = changed.map((passage) => ({
      nodePath: passage.nodePath, nodeType: passage.nodeType, heading: passage.heading || null,
      content: passage.content, contentHash: passage.contentHash, tags,
      existingLinks: passage.existingLinks, embeddingModel: model,
      embedding: vectorLiteral(changedEmbedding.get(passage.nodePath)!),
    }))
    if (changedRows.length) {
      await client.query(
        `WITH incoming AS (
           SELECT * FROM jsonb_to_recordset($3::jsonb) AS row(
             "nodePath" text, "nodeType" text, heading text, content text, "contentHash" text,
             tags jsonb, "existingLinks" jsonb, "embeddingModel" text, embedding text
           )
         )
         INSERT INTO navi.link_passages
           (post_id, locale, node_path, node_type, heading, content, content_hash, tags,
            existing_links, embedding_model, embedding, updated_at)
         SELECT $1, $2, "nodePath", "nodeType", heading, content, "contentHash", tags,
                "existingLinks", "embeddingModel", embedding::vector, NOW()
           FROM incoming
         ON CONFLICT (post_id, locale, node_path) DO UPDATE SET
           node_type = EXCLUDED.node_type, heading = EXCLUDED.heading, content = EXCLUDED.content,
           content_hash = EXCLUDED.content_hash, tags = EXCLUDED.tags,
           existing_links = EXCLUDED.existing_links, embedding_model = EXCLUDED.embedding_model,
           embedding = EXCLUDED.embedding, updated_at = NOW()`,
        [post.id, locale, JSON.stringify(changedRows)],
      )
    }

    const unchangedRows = passages.filter((passage) => !changedEmbedding.has(passage.nodePath)).map((passage) => ({
      nodePath: passage.nodePath, nodeType: passage.nodeType, heading: passage.heading || null,
      tags, existingLinks: passage.existingLinks,
    }))
    if (unchangedRows.length) {
      await client.query(
        `WITH incoming AS (
           SELECT * FROM jsonb_to_recordset($3::jsonb) AS row(
             "nodePath" text, "nodeType" text, heading text, tags jsonb, "existingLinks" jsonb
           )
         )
         UPDATE navi.link_passages AS passage SET
           node_type = incoming."nodeType", heading = incoming.heading, tags = incoming.tags,
           existing_links = incoming."existingLinks", updated_at = NOW()
         FROM incoming
         WHERE passage.post_id = $1 AND passage.locale = $2 AND passage.node_path = incoming."nodePath"`,
        [post.id, locale, JSON.stringify(unchangedRows)],
      )
    }

    // Existing/applied edges are reconstructed from the content. Editorially
    // rejected suggestions remain available as negative feedback for ranking.
    await client.query(
      "DELETE FROM navi.internal_links WHERE source_post_id = $1 AND source_locale = $2 AND state IN ('existing', 'applied')",
      [post.id, locale],
    )
    const edgeCandidates = passages.flatMap((passage) => passage.existingLinks.flatMap((link) => {
        const normalized = normalizeInternalURL(link.url)
        if (!normalized) return []
        const route = normalized.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
        return [{
          sourceNodePath: passage.nodePath, sourceContentHash: passage.contentHash,
          targetPostId: routes.get(route) || null, targetUrl: normalized, anchorText: link.anchor,
        }]
      }))
    const existingEdges = [...new Map(edgeCandidates.map((edge) => [
      `${edge.sourceNodePath}\u0000${edge.anchorText}\u0000${edge.targetUrl}`,
      edge,
    ])).values()]
    if (existingEdges.length) {
      await client.query(
        `WITH incoming AS (
           SELECT * FROM jsonb_to_recordset($3::jsonb) AS row(
             "sourceNodePath" text, "sourceContentHash" text, "targetPostId" integer,
             "targetUrl" text, "anchorText" text
           )
         )
         INSERT INTO navi.internal_links
           (source_post_id, source_locale, source_node_path, source_content_hash,
            target_post_id, target_url, anchor_text, state, updated_at)
         SELECT $1, $2, "sourceNodePath", "sourceContentHash", "targetPostId",
                "targetUrl", "anchorText", 'existing', NOW()
           FROM incoming
         ON CONFLICT (source_post_id, source_locale, source_node_path, anchor_text, target_url)
         DO UPDATE SET target_post_id = EXCLUDED.target_post_id,
           source_content_hash = EXCLUDED.source_content_hash, state = 'existing', updated_at = NOW()`,
        [post.id, locale, JSON.stringify(existingEdges)],
      )
    }
    linkCount = existingEdges.length
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return { indexed: passages.length, embedded: changed.length, links: linkCount }
}

/** Remove a post from the active semantic index and link graph. */
export async function purgePostLinkIndex(payload: any, postId: number, locale?: ContentLocale): Promise<void> {
  const pool = payload.db?.pool
  if (!pool?.query) throw new Error('Payload Postgres pool is unavailable')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (locale) {
      await client.query('DELETE FROM navi.link_passages WHERE post_id = $1 AND locale = $2', [postId, locale])
      await client.query(
        `DELETE FROM navi.internal_links
          WHERE source_locale = $2 AND (source_post_id = $1 OR target_post_id = $1)
            AND state <> 'rejected'`,
        [postId, locale],
      )
    } else {
      await client.query('DELETE FROM navi.link_passages WHERE post_id = $1', [postId])
      await client.query(
        `DELETE FROM navi.internal_links
          WHERE (source_post_id = $1 OR target_post_id = $1) AND state <> 'rejected'`,
        [postId],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function backfillLinkIndex(payload: any, options: {
  cursor?: number
  limit?: number
  locales?: ContentLocale[]
  continueOnError?: boolean
} = {}): Promise<{
  processed: number
  nextCursor: number | null
  done: boolean
  passages: number
  embedded: number
  links: number
  failed: number
}> {
  const cursor = Math.max(0, Number(options.cursor || 0))
  const limit = Math.min(10, Math.max(1, Number(options.limit || 5)))
  const locales: ContentLocale[] = options.locales?.length ? options.locales : ['ru', 'uk', 'en']
  const result = await payload.find({
    collection: 'posts-new', locale: locales[0], fallbackLocale: false, depth: 0,
    limit, sort: 'id',
    where: { and: [{ publicationStatus: { equals: 'published' } }, { id: { greater_than: cursor } }] },
  })
  let passages = 0
  let embedded = 0
  let links = 0
  let failed = 0
  for (const base of result.docs as any[]) {
    for (const locale of locales) {
      payload.logger.info({ postId: base.id, locale }, 'Indexing localized article passages')
      const post = await payload.findByID({ collection: 'posts-new', id: base.id, locale, fallbackLocale: false, depth: 0 }) as any
      if (!post?.content || !post?.name) continue
      try {
        const stats = await syncPostLinkIndex(payload, post, locale)
        passages += stats.indexed
        embedded += stats.embedded
        links += stats.links
      } catch (error) {
        if (!options.continueOnError) throw error
        failed += 1
        payload.logger.error({ err: error, postId: base.id, locale }, 'Localized article index failed; continuing backfill')
      }
    }
  }
  const last = result.docs.at(-1) as any
  return {
    processed: result.docs.length,
    nextCursor: last ? Number(last.id) : null,
    done: result.docs.length < limit,
    passages,
    embedded,
    links,
    failed,
  }
}

function queryText(post: any): string {
  const passages = extractLinkPassages(post.content)
  return [post.name, post.summary, ...passages.slice(0, 8).map((passage) => `${passage.heading || ''} ${passage.content}`)]
    .filter(Boolean).join('\n').slice(0, 8_000)
}

function lexicalOverlap(query: string, passage: string): number {
  const words = new Set(normalizeSpace(query).toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 4))
  if (!words.size) return 0
  const candidate = new Set(normalizeSpace(passage).toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u))
  return [...words].filter((word) => candidate.has(word)).length / words.size
}

/**
 * Hybrid retrieval: semantic similarity + topic tags + lexical overlap, with
 * graph constraints and page diversity applied before anything reaches an LLM.
 */
export async function retrieveRelatedPassages(
  payload: any,
  target: any,
  locale: ContentLocale,
  limit = 12,
  direction: 'inbound' | 'outbound' = 'inbound',
): Promise<RelatedPassage[]> {
  const pool = payload.db?.pool
  if (!pool?.query) throw new Error('Payload Postgres pool is unavailable')
  const query = queryText(target)
  const [embedding] = await embedPassages([query])
  const prefix = locale === 'uk' ? 'ua' : locale
  const targetSlug = target.publicSlug || target.slug
  const targetURL = `/${prefix}/blog/${String(targetSlug || '').replace(/^\/+|\/+$/g, '')}/`
  const graphExclusion = direction === 'inbound'
    ? `(edge.source_post_id = lp.post_id AND (edge.target_post_id = $2 OR edge.target_url = $4))`
    : `(edge.source_post_id = $2 AND edge.target_post_id = lp.post_id)`
  const result = await pool.query(
    `SELECT lp.post_id, lp.node_path, lp.node_type, lp.heading, lp.content, lp.content_hash,
            lp.tags, lp.existing_links, p.public_slug, pl.slug, pl.name,
            1 - (lp.embedding <=> $3::vector) AS semantic_score,
            (SELECT count(*)::int FROM navi.internal_links src
              WHERE src.source_post_id = lp.post_id AND src.source_locale = $1
                AND src.state IN ('existing', 'applied')) AS source_link_count,
            (SELECT count(*)::int FROM navi.internal_links incoming
              WHERE incoming.target_post_id = lp.post_id AND incoming.source_locale = $1
                AND incoming.state IN ('existing', 'applied')) AS target_inbound_count
       FROM navi.link_passages lp
       JOIN navi.posts_new p ON p.id = lp.post_id
       JOIN navi.posts_new_locales pl ON pl._parent_id = p.id AND pl._locale::text = $1
      WHERE lp.locale = $1 AND lp.post_id <> $2 AND p.publication_status = 'published'
        AND lp.embedding_model = $5
        AND jsonb_array_length(lp.existing_links) < 2
        AND NOT EXISTS (
          SELECT 1 FROM navi.internal_links edge
           WHERE edge.source_post_id = lp.post_id AND edge.source_locale = $1
             AND edge.state IN ('existing', 'applied', 'rejected')
             AND ${graphExclusion}
        )
      ORDER BY lp.embedding <=> $3::vector
      LIMIT 60`,
    [locale, target.id, vectorLiteral(embedding), targetURL, embeddingModel()],
  )
  const targetTags = new Set(tagIds(target))
  const ranked = rowsOf(result).map((row: any) => {
    const candidateTags = new Set((Array.isArray(row.tags) ? row.tags : []).map(String))
    const tagScore = targetTags.size ? [...targetTags].filter((id) => candidateTags.has(id)).length / targetTags.size : 0
    const semanticScore = Number(row.semantic_score || 0)
    const sourceLinkCount = Number(row.source_link_count || 0)
    const targetInboundCount = Number(row.target_inbound_count || 0)
    const graphLoad = direction === 'inbound' ? sourceLinkCount : targetInboundCount
    const hybridScore = semanticScore * 0.75 + tagScore * 0.15 + lexicalOverlap(query, row.content) * 0.1 - Math.min(graphLoad, 20) * 0.003
    return {
      postId: Number(row.post_id), nodePath: String(row.node_path), nodeType: String(row.node_type),
      heading: row.heading || undefined, content: String(row.content), contentHash: String(row.content_hash),
      existingLinks: Array.isArray(row.existing_links) ? row.existing_links : [], title: String(row.name || ''),
      slug: String(row.public_slug || row.slug || ''), semanticScore, hybridScore, sourceLinkCount, targetInboundCount,
    } satisfies RelatedPassage
  }).sort((a: RelatedPassage, b: RelatedPassage) => b.hybridScore - a.hybridScore)

  const perPost = new Map<number, number>()
  return ranked.filter((passage: RelatedPassage) => {
    const count = perPost.get(passage.postId) || 0
    if (count >= 2 || (direction === 'inbound' && passage.sourceLinkCount >= 12)) return false
    perPost.set(passage.postId, count + 1)
    return true
  }).slice(0, limit)
}

export async function recordLinkSuggestions(payload: any, suggestions: LinkSuggestion[], locale: ContentLocale): Promise<void> {
  const pool = payload.db?.pool
  if (!pool?.query || !suggestions.length) return
  for (const link of suggestions) {
    await pool.query(
      `INSERT INTO navi.internal_links
        (source_post_id, source_locale, source_node_path, source_content_hash, target_post_id, target_url,
         anchor_text, state, relevance_score, reason, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'suggested', $8, $9, NOW())
       ON CONFLICT (source_post_id, source_locale, source_node_path, anchor_text, target_url)
       DO UPDATE SET target_post_id = EXCLUDED.target_post_id, source_content_hash = EXCLUDED.source_content_hash,
         relevance_score = EXCLUDED.relevance_score, reason = EXCLUDED.reason, state = 'suggested', updated_at = NOW()`,
      [link.sourcePostId, locale, link.sourceNodePath, link.sourceContentHash, link.targetPostId || null, link.url, link.anchor, link.relevanceScore || null, link.reason || null],
    )
  }
}

function nodeAtPath(content: any, path: string): LexicalNode | null {
  const indexes = path.split('.').map(Number)
  let current: LexicalNode | undefined = content?.root
  for (const index of indexes) {
    if (!current?.children || !Number.isInteger(index)) return null
    current = current.children[index]
  }
  return current || null
}

/** Apply only when the exact indexed block is still present and unchanged. */
export function applyLinkSuggestion(content: unknown, suggestion: Pick<LinkSuggestion, 'sourceNodePath' | 'sourceContentHash' | 'anchor' | 'url'>): unknown {
  const clone = structuredClone(content) as any
  const block = nodeAtPath(clone, suggestion.sourceNodePath)
  if (!block || hashText(textOf(block)) !== suggestion.sourceContentHash) return clone
  let applied = false
  const visit = (node: LexicalNode, insideLink = false) => {
    if (applied || !Array.isArray(node.children)) return
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index]
      if (!insideLink && child.type === 'text' && typeof child.text === 'string' && child.text.includes(suggestion.anchor)) {
        const start = child.text.indexOf(suggestion.anchor)
        const before = child.text.slice(0, start)
        const after = child.text.slice(start + suggestion.anchor.length)
        const linkNode: LexicalNode = {
          type: 'link', version: 2, url: suggestion.url, newTab: false, format: '', indent: 0,
          fields: { linkType: 'custom', url: suggestion.url, newTab: false },
          children: [{ ...child, text: suggestion.anchor }], direction: null,
        }
        node.children.splice(index, 1, ...[before && { ...child, text: before }, linkNode, after && { ...child, text: after }].filter(Boolean) as LexicalNode[])
        applied = true
        return
      }
      visit(child, insideLink || child.type === 'link' || child.type === 'autolink')
    }
  }
  visit(block)
  return clone
}
