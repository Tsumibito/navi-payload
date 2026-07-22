import type { TaskConfig } from 'payload'
import { sql } from '@payloadcms/db-postgres/drizzle'

import { CONTENT_LOCALES, type ContentLocale, YACHTING_GLOSSARY } from '../config/contentLocales'
import { buildSeoContentContext, enrichKeywordEntries, serializeKeywords, type AdditionalFieldsValue } from '../utils/seoAnalysis'
import { generateSlug } from '../utils/slug'
import { generatePostSocialImages } from '../utils/socialImages'
import {
  applyLinkSuggestion,
  extractLinkPassages,
  recordLinkSuggestions,
  retrieveRelatedPassages,
  syncPostLinkIndex,
} from '../utils/internalLinkRag'

type LexicalNode = { type?: string; text?: string; children?: LexicalNode[]; [key: string]: unknown }
type GlossaryTranslation = { locale?: string; term?: string; aliases?: Array<{ value?: string }>; definition?: string; usageNotes?: string; forbiddenVariants?: Array<{ value?: string }>; status?: string }
const GLOSSARY_DOMAINS = new Set(['general', 'sailing', 'navigation', 'meteorology', 'safety', 'radio', 'rigging', 'boatbuilding', 'racing', 'charter', 'certification'])

function localizationModel() {
  return process.env.OPENROUTER_LOCALIZATION_MODEL?.trim() || 'openai/gpt-5.6-luna'
}

function editorialModel() {
  return process.env.OPENROUTER_EDITORIAL_MODEL?.trim() || 'z-ai/glm-5.2'
}

function linkingModel() {
  return process.env.OPENROUTER_LINKING_MODEL?.trim() || 'deepseek/deepseek-v4-flash'
}

function imageModel() {
  return process.env.OPENROUTER_IMAGE_MODEL?.trim() || 'google/gemini-3.1-flash-image'
}

async function openRouterJSON(system: string, prompt: string, model = localizationModel(), maxTokens = 8_192): Promise<Record<string, any>> {
  const token = process.env.OPENROUTER_TOKEN?.trim()
  if (!token) throw new Error('OPENROUTER_TOKEN is not configured')
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://payload.navi.training',
      'X-Title': 'Navi.training Payload localization',
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    }),
  })
  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 500)}`)
  const body = await response.json() as any
  const content = body.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenRouter returned an empty response')
  return JSON.parse(content)
}

async function generateHeroImage(payload: any, prompt: string, title: string) {
  const token = process.env.OPENROUTER_TOKEN?.trim()
  if (!token) throw new Error('OPENROUTER_TOKEN is not configured')
  const response = await fetch('https://openrouter.ai/api/v1/images', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: imageModel(), n: 1, aspect_ratio: '16:9', resolution: '2K', output_format: 'webp', quality: 'high',
      prompt: `${prompt.trim()}\nEditorial hero image for “${title}”. Professional sailing and maritime context. No logos, watermarks or readable interface text. Photorealistic unless the prompt explicitly requests another style.`,
    }),
  })
  if (!response.ok) throw new Error(`OpenRouter image ${response.status}: ${(await response.text()).slice(0, 500)}`)
  const body = await response.json() as any
  const encoded = body.data?.[0]?.b64_json
  if (typeof encoded !== 'string' || !encoded) throw new Error('OpenRouter returned no image bytes')
  const data = Buffer.from(encoded, 'base64')
  if (data.length < 10_000) throw new Error('Generated image is unexpectedly small')
  const mediaType = body.data?.[0]?.media_type || 'image/webp'
  const extension = mediaType === 'image/png' ? 'png' : mediaType === 'image/jpeg' ? 'jpg' : 'webp'
  return payload.create({
    collection: 'media',
    data: { alt: title },
    file: { data, mimetype: mediaType, name: `post-${Date.now()}.${extension}`, size: data.length },
  })
}

function collectTextNodes(value: unknown, result: Array<{ id: string; node: LexicalNode }> = []): Array<{ id: string; node: LexicalNode }> {
  if (!value || typeof value !== 'object') return result
  if (Array.isArray(value)) {
    value.forEach((child) => collectTextNodes(child, result))
    return result
  }
  const node = value as LexicalNode
  if (node.type === 'text' && node.text?.trim()) result.push({ id: String(result.length), node })
  Object.values(node).forEach((child) => collectTextNodes(child, result))
  return result
}

export function normalizeLexicalRelations(content: unknown): unknown {
  const clone = structuredClone(content) as any
  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return
    if ((value.type === 'upload' || value.type === 'relationship') && value.value && typeof value.value === 'object') {
      const id = relationId(value.value)
      if (id !== undefined) value.value = id
    }
    Object.values(value).forEach(visit)
  }
  visit(clone)
  return clone
}

async function translateLexical(content: unknown, source: ContentLocale, target: ContentLocale, glossary = ''): Promise<unknown> {
  const clone = normalizeLexicalRelations(content)
  const nodes = collectTextNodes(clone)
  for (let offset = 0; offset < nodes.length; offset += 35) {
    const batch = nodes.slice(offset, offset + 35)
    const translated = await openRouterJSON(
      `You are a professional maritime translator and Navi.training editor. Translate from ${source} into natural, publication-quality ${target}; never leave source-language prose in the result. ${YACHTING_GLOSSARY}\n${glossary} Preserve technical meaning, units, cautions, punctuation, inline spacing and the relationship between adjacent fragments. Use established yacht terminology rather than literal calques. Do not add facts or marketing language. Return only JSON {"items":{"id":"translation"}}.`,
      JSON.stringify({ items: Object.fromEntries(batch.map(({ id, node }) => [id, node.text])) }),
    )
    for (const { id, node } of batch) {
      const value = translated.items?.[id]
      if (typeof value === 'string' && value.trim()) node.text = value
    }
  }
  return clone
}

function localizeInternalURLs(content: unknown, target: ContentLocale): unknown {
  const clone = structuredClone(content) as any
  const prefix = target === 'uk' ? 'ua' : target
  const visit = (value: any) => {
    if (!value || typeof value !== 'object') return
    if ((value.type === 'link' || value.type === 'autolink') && typeof (value.fields?.url || value.url) === 'string') {
      const original = value.fields?.url || value.url
      try {
        const parsed = new URL(original, 'https://navi.training')
        if (['navi.training', 'www.navi.training'].includes(parsed.hostname)) {
          parsed.pathname = parsed.pathname.replace(/^\/(ru|ua|en)(?=\/|$)/, `/${prefix}`)
          const localized = original.startsWith('http') ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`
          value.url = localized
          value.fields = { ...(value.fields || {}), url: localized }
        }
      } catch { /* keep malformed editorial URLs for review */ }
    }
    Object.values(value).forEach(visit)
  }
  visit(clone)
  return clone
}

async function generateEditorialFields(args: { content: unknown; locale: ContentLocale; name: string; summary?: string; glossary?: string }) {
  const plainText = collectTextNodes(structuredClone(args.content)).map(({ node }) => node.text).join(' ').slice(0, 24_000)
  return openRouterJSON(
    `You are the senior multilingual editor of Navi.training, a professional sailing school. Write exclusively in ${args.locale}; never mix languages. ${YACHTING_GLOSSARY}\n${args.glossary || ''}
Return JSON with title, summary, seoTitle, metaDescription, focusKeyphrase, linkKeywords and imageAlt. The summary is two concrete sentences (220-320 characters) explaining what the reader will learn. SEO title is 45-60 characters and preserves the real search intent. Meta description is 135-160 characters with a natural benefit, not a keyword list. focusKeyphrase must be one natural 2-6 word search phrase that already occurs verbatim in the supplied article title and at least once in the article body; include that exact phrase once in seoTitle, metaDescription and summary. linkKeywords must be an array of 5-8 distinct, useful internal-link anchor phrases (2-6 words each) that occur verbatim in the article body; exclude focusKeyphrase and generic words. imageAlt describes only the likely article subject, without “image of”. Do not invent prices, laws, qualifications or equipment capabilities. Avoid clickbait, generic praise and repeated phrases.`,
    JSON.stringify({ title: args.name, currentSummary: args.summary, article: plainText }),
  )
}

function buildGeneratedKeywords(editorial: any, content: unknown, faqs: any[]): AdditionalFieldsValue {
  const focus = String(editorial?.focusKeyphrase || '').trim().toLocaleLowerCase()
  const seen = new Set<string>()
  const article = lexicalPlainText(content).toLocaleLowerCase()
  const keywords = (Array.isArray(editorial?.linkKeywords) ? editorial.linkKeywords : [])
    .flatMap((value: unknown) => typeof value === 'string' ? [value.trim()] : [])
    .filter((keyword: string) => {
      const normalized = keyword.toLocaleLowerCase()
      if (!normalized || normalized === focus || seen.has(normalized) || !article.includes(normalized)) return false
      const words = keyword.split(/\s+/).filter(Boolean)
      if (words.length < 2 || words.length > 6) return false
      seen.add(normalized)
      return true
    })
    .slice(0, 8)
    .map((keyword: string) => ({ keyword, notes: '', linksCount: 0, potentialLinksCount: 0, cachedTotal: 0, cachedHeadings: 0 }))
  return enrichKeywordEntries({
    keywords,
    context: buildSeoContentContext({ content, faqs }),
  }).value
}

async function saveGeneratedKeywords(payload: any, postId: string | number, locale: ContentLocale, focusKeyphrase: string, value: AdditionalFieldsValue) {
  const json = JSON.stringify(value)
  const calculatedAt = new Date().toISOString()
  await payload.db.drizzle.execute(sql`
    INSERT INTO navi."seo-stats" AS existing
      (entity_type, entity_id, locale, focus_keyphrase, stats, link_keywords, calculated_at, created_at, updated_at)
    VALUES
      ('posts-new', ${String(postId)}, ${locale}, ${focusKeyphrase}, '{}'::jsonb, ${json}::jsonb, ${calculatedAt}::timestamp, NOW(), NOW())
    ON CONFLICT (entity_type, entity_id, locale) DO UPDATE SET
      focus_keyphrase = EXCLUDED.focus_keyphrase,
      link_keywords = EXCLUDED.link_keywords,
      calculated_at = EXCLUDED.calculated_at,
      updated_at = NOW()
  `)
}

function lexicalParagraph(text: string): unknown {
  return {
    root: {
      type: 'root', version: 1, format: '', indent: 0, direction: null,
      children: [{
        type: 'paragraph', version: 1, format: '', indent: 0, direction: null, textFormat: 0, textStyle: '',
        children: [{ type: 'text', version: 1, detail: 0, format: 0, mode: 'normal', style: '', text }],
      }],
    },
  }
}

function hasRichText(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const root = (value as any).root
  if (!root || !Array.isArray(root.children)) return false
  const stack = [...root.children]
  while (stack.length) {
    const node = stack.pop()
    if (typeof node?.text === 'string' && node.text.trim()) return true
    if (Array.isArray(node?.children)) stack.push(...node.children)
  }
  return false
}

function validFAQs(value: unknown): any[] {
  if (!Array.isArray(value)) return []
  return value.filter((faq) => typeof faq?.question === 'string' && faq.question.trim() && hasRichText(faq.answer))
}

async function generateFAQs(content: unknown, locale: ContentLocale, glossary = ''): Promise<any[]> {
  const article = lexicalPlainText(content).slice(0, 30_000)
  const response = await openRouterJSON(
    `You are the practical knowledge editor of Navi.training. Create 4-6 FAQs exclusively in ${locale}. Questions must match real reader intent and be answerable from the article; cover different decisions or misunderstandings instead of paraphrasing one question. ${YACHTING_GLOSSARY}\n${glossary} Each answer is self-contained, factually conservative and 35-80 words. Preserve necessary safety caveats. Do not invent legal requirements, prices or equipment capabilities. Return JSON {"faqs":[{"question":"...","answer":"..."}]}.`,
    JSON.stringify({ article }),
  )
  return (Array.isArray(response.faqs) ? response.faqs : []).flatMap((faq: any) => {
    if (typeof faq?.question !== 'string' || typeof faq?.answer !== 'string' || !faq.question.trim() || !faq.answer.trim()) return []
    return [{ question: faq.question.trim(), answer: lexicalParagraph(faq.answer.trim()) }]
  }).slice(0, 6)
}

async function generateLinkPlan(payload: any, post: any, locale: ContentLocale) {
  const related = await retrieveRelatedPassages(payload, post, locale, 14, 'outbound')
  if (!related.length) return []
  const sourcePassages = extractLinkPassages(post.content)
    .filter((passage) => !passage.existingLinks.length && passage.content.length >= 70)
    .slice(0, 18)
  if (!sourcePassages.length) return []
  const targets = [...new Map(related.map((passage) => [passage.postId, {
    id: passage.postId, title: passage.title, slug: passage.slug,
    relevantPassage: passage.content, score: Number(passage.hybridScore.toFixed(4)),
  }])).values()].slice(0, 8)
  const response = await openRouterJSON(
    `You design useful topic-cluster internal links for a sailing school. Select 2-6 links from the source passages to the supplied target pages. Use no more than one link per source passage and one per target. The anchor must be an exact natural phrase already present verbatim in that source passage, 2-7 words, descriptive without keyword stuffing. Do not place a link in a passage that already contains one. Return JSON {"links":[{"targetId":1,"sourceNodePath":"0.2","anchor":"exact text","reason":"reader benefit"}]}.`,
    JSON.stringify({ sourcePassages: sourcePassages.map((passage) => ({ nodePath: passage.nodePath, heading: passage.heading, text: passage.content.slice(0, 1_200) })), targets }), linkingModel(), 1_600,
  )
  const byId = new Map(targets.map((target) => [String(target.id), target]))
  const byPath = new Map(sourcePassages.map((passage) => [passage.nodePath, passage]))
  const prefix = locale === 'uk' ? 'ua' : locale
  const links = (Array.isArray(response.links) ? response.links : []).flatMap((link: any) => {
    const target: any = byId.get(String(link.targetId))
    const passage = byPath.get(String(link.sourceNodePath))
    if (!target?.slug || !passage || typeof link.anchor !== 'string' || !passage.content.includes(link.anchor)) return []
    return [{
      ...link, sourcePostId: Number(post.id), sourceNodePath: passage.nodePath,
      sourceContentHash: passage.contentHash, targetId: target.id, targetPostId: target.id,
      url: `/${prefix}/blog/${target.slug}/`, relevanceScore: Number(target.score || 0),
    }]
  }).slice(0, 6)
  await recordLinkSuggestions(payload, links, locale)
  return links
}

async function generateInboundLinkPlan(payload: any, target: any, locale: ContentLocale) {
  const prefix = locale === 'uk' ? 'ua' : locale
  const targetSlug = target.publicSlug || target.slug
  if (!targetSlug) return []
  const targetURL = `/${prefix}/blog/${targetSlug}/`
  const sources = await retrieveRelatedPassages(payload, target, locale, 12)
  if (!sources.length) return []
  const response = await openRouterJSON(
    `Select 2-5 published sailing passages that should link to the new target article. For every source choose one exact natural 2-7 word anchor phrase already present verbatim in that single passage. Do not rewrite the paragraph, invent an anchor or select a passage that already has a link. Prefer different source pages and genuine reader value over SEO repetition. Return JSON {"links":[{"sourcePostId":1,"sourceNodePath":"0.2","anchor":"exact phrase","reason":"reader benefit"}]}.`,
    JSON.stringify({
      target: { title: target.name, summary: target.summary, url: targetURL },
      sources: sources.map((source) => ({ postId: source.postId, title: source.title, nodePath: source.nodePath, heading: source.heading, passage: source.content.slice(0, 1_200), score: Number(source.hybridScore.toFixed(4)) })),
    }), linkingModel(), 1_600,
  )
  const byKey = new Map(sources.map((source) => [`${source.postId}:${source.nodePath}`, source]))
  const links = (Array.isArray(response.links) ? response.links : []).flatMap((link: any) => {
    const source = byKey.get(`${link.sourcePostId}:${link.sourceNodePath}`)
    if (!source || typeof link.anchor !== 'string' || !source.content.includes(link.anchor)) return []
    return [{
      ...link, sourcePostId: source.postId, sourceTitle: source.title,
      sourceNodePath: source.nodePath, sourceContentHash: source.contentHash,
      targetPostId: Number(target.id), url: targetURL, relevanceScore: source.hybridScore,
    }]
  }).slice(0, 5)
  await recordLinkSuggestions(payload, links, locale)
  return links
}

function relationId(value: any): string | number | undefined {
  if (value == null) return undefined
  if (typeof value !== 'object') return value
  if ('value' in value) return relationId(value.value)
  return value.id
}

async function selectTags(payload: any, post: any, locale: ContentLocale): Promise<Array<string | number>> {
  const result = await payload.find({ collection: 'tags-new', locale, fallbackLocale: false, depth: 0, limit: 0 })
  const candidates = result.docs.map((tag: any) => ({ id: tag.id, name: tag.name, slug: tag.slug, summary: tag.summary })).filter((tag: any) => tag.name)
  const article = lexicalPlainText(post.content).slice(0, 24_000)
  const response = await openRouterJSON(
    `You are the taxonomy editor for Navi.training. Select 3-6 existing tags that precisely describe the article and place it in a coherent sailing topic cluster. Choose one primary subject, then only supporting concepts materially covered in the text. Prefer specific tags; reject generic, adjacent or merely mentioned topics. Never invent an ID. Return JSON {"tagIds":[1,2],"reason":"..."}.`,
    JSON.stringify({ title: post.name, summary: post.summary, article, candidates }), editorialModel(),
  )
  const allowed = new Set(candidates.map((tag: any) => String(tag.id)))
  const selected = (Array.isArray(response.tagIds) ? response.tagIds : []).filter((id: any) => allowed.has(String(id))).slice(0, 6)
  const fallback = (post.tags || []).map(relationId).filter(Boolean).slice(0, 6) as Array<string | number>
  return selected.length >= 2 ? selected : fallback
}

function assertLocalizedResult(args: { locale: ContentLocale; post: any; editorial: any; faqs: any[]; linkPlan: any[] }) {
  const text = lexicalPlainText(args.post.content)
  if (!args.post.name?.trim() || text.split(/\s+/).length < 150) throw new Error(`${args.locale}: localized article is incomplete`)
  if (!args.editorial?.seoTitle || !args.editorial?.metaDescription || !args.editorial?.focusKeyphrase || !args.editorial?.imageAlt) throw new Error(`${args.locale}: editorial fields are incomplete`)
  if (String(args.editorial.seoTitle).length > 65 || String(args.editorial.metaDescription).length < 100 || String(args.editorial.metaDescription).length > 175) throw new Error(`${args.locale}: invalid SEO lengths`)
  if (validFAQs(args.faqs).length < 4) throw new Error(`${args.locale}: fewer than four valid FAQs`)
  if (args.linkPlan.length > 6) throw new Error(`${args.locale}: too many outgoing links`)
}

async function applyInboundLinks(payload: any, plan: any[], locale: ContentLocale) {
  for (const link of plan) {
    const source = await payload.findByID({ collection: 'posts-new', id: link.sourcePostId, locale, fallbackLocale: false, depth: 0 })
    if (!source?.content || JSON.stringify(source.content).includes(link.url)) continue
    const content = link.sourceNodePath && link.sourceContentHash
      ? applyLinkSuggestion(source.content, link)
      : applyLinkPlan(source.content, [{ anchor: link.anchor, url: link.url }])
    if (JSON.stringify(content) === JSON.stringify(source.content)) continue
    await payload.update({ collection: 'posts-new', id: source.id, locale, context: { skipLocalizationWorkflow: true }, data: { content } })
    await syncPostLinkIndex(payload, { ...source, content }, locale)
  }
}

function applyLinkPlan(content: unknown, links: any[]): unknown {
  let clone = structuredClone(content) as any
  const targeted = links.filter((link) => link?.sourceNodePath && link?.sourceContentHash && link?.url && link?.anchor)
  for (const link of targeted) clone = applyLinkSuggestion(clone, link)
  const pending = links.filter((link) => !link?.sourceNodePath && link?.url && link?.anchor).map((link) => ({ ...link, applied: false }))
  const visit = (node: any, insideLink = false) => {
    if (!node || typeof node !== 'object') return
    if (!Array.isArray(node.children)) return
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index]
      if (!insideLink && child?.type === 'text' && typeof child.text === 'string') {
        const link = pending.find((item) => !item.applied && child.text.includes(item.anchor))
        if (link) {
          const start = child.text.indexOf(link.anchor)
          const before = child.text.slice(0, start)
          const after = child.text.slice(start + link.anchor.length)
          const textNode = { ...child, text: link.anchor }
          const linkNode = {
            type: 'link', version: 2, url: link.url, newTab: false, format: '', indent: 0,
            fields: { linkType: 'custom', url: link.url, newTab: false }, children: [textNode], direction: null,
          }
          node.children.splice(index, 1, ...[before && { ...child, text: before }, linkNode, after && { ...child, text: after }].filter(Boolean))
          link.applied = true
          index += before ? 1 : 0
          continue
        }
      }
      visit(child, insideLink || child?.type === 'link')
    }
  }
  visit(clone)
  return clone
}

async function translateFAQs(faqs: any[], source: ContentLocale, target: ContentLocale, glossary = ''): Promise<any[]> {
  return Promise.all((faqs || []).map(async (faq) => {
    const question = await openRouterJSON(
      `Translate this sailing FAQ question from ${source} to ${target}. ${YACHTING_GLOSSARY}\n${glossary} Return JSON {"question":"..."}.`,
      JSON.stringify({ question: faq.question }),
    )
    return { ...faq, question: question.question, answer: await translateLexical(faq.answer, source, target, glossary) }
  }))
}

async function learnGlossaryCandidates(payload: any, post: any, sourceLocale: ContentLocale) {
  const article = lexicalPlainText(post.content).slice(0, 60_000)
  const response = await openRouterJSON(
    `Extract only specialist sailing, navigation, weather, safety, radio, rigging and certification concepts whose translation requires domain knowledge. Do not include generic words or brands. Return at most 30 concepts as JSON {"concepts":[{"canonicalEnglish":"...","domain":"sailing","translations":{"ru":"...","uk":"...","en":"...","fr":"...","es":"...","de":"...","pl":"..."},"definition":"..."}]}. Use professional terminology; suggestions are for editorial review, not automatic approval.`,
    JSON.stringify({ sourceLocale, title: post.name, article }),
  )
  for (const concept of Array.isArray(response.concepts) ? response.concepts : []) {
    if (!concept?.canonicalEnglish || !concept?.translations?.en) continue
    const canonicalKey = generateSlug(String(concept.canonicalEnglish)).slice(0, 180)
    if (!canonicalKey) continue
    const found = await payload.find({ collection: 'glossary-terms', depth: 0, limit: 1, where: { canonicalKey: { equals: canonicalKey } } })
    const existing = found.docs?.[0]
    const existingLocales = new Set((existing?.translations || []).map((item: GlossaryTranslation) => item.locale))
    const proposals = Object.entries(concept.translations).flatMap(([locale, term]) => typeof term === 'string' && term.trim() && !existingLocales.has(locale) ? [{ locale, term: term.trim(), definition: concept.definition, status: 'proposed', provenance: 'article', confidence: 0.7 }] : [])
    if (existing) {
      await payload.update({ collection: 'glossary-terms', id: existing.id, data: { translations: [...(existing.translations || []), ...proposals], evidencePosts: [...new Set([...(existing.evidencePosts || []).map((value: any) => typeof value === 'object' ? value.id : value), post.id])] } })
    } else {
      await payload.create({ collection: 'glossary-terms', data: { canonicalKey, domain: GLOSSARY_DOMAINS.has(concept.domain) ? concept.domain : 'general', status: 'proposed', translations: proposals, evidencePosts: [post.id] } })
    }
  }
}

async function loadApprovedGlossary(payload: any, article: unknown, sourceLocale: ContentLocale, targetLocale: ContentLocale): Promise<string> {
  const text = lexicalPlainText(article).toLocaleLowerCase(sourceLocale)
  const result = await payload.find({ collection: 'glossary-terms', depth: 0, limit: 0, where: { status: { equals: 'approved' } } })
  const matches = result.docs.flatMap((doc: any) => {
    const translations = doc.translations as GlossaryTranslation[]
    const source = translations.find((item) => item.locale === sourceLocale && item.status === 'approved')
    const target = translations.find((item) => item.locale === targetLocale && item.status === 'approved')
    const variants = [source?.term, ...(source?.aliases || []).map((item) => item.value)].filter(Boolean) as string[]
    if (!source?.term || !target?.term || !variants.some((term) => text.includes(term.toLocaleLowerCase(sourceLocale)))) return []
    const forbidden = (target.forbiddenVariants || []).map((item) => item.value).filter(Boolean)
    return [`${source.term} => ${target.term}${target.usageNotes ? ` (${target.usageNotes})` : ''}${forbidden.length ? `; avoid: ${forbidden.join(', ')}` : ''}`]
  }).slice(0, 250)
  return matches.length ? `Approved Navi.training terminology:\n${matches.join('\n')}` : ''
}

function lexicalPlainText(content: unknown): string {
  return collectTextNodes(structuredClone(content)).map(({ node }) => node.text).join(' ').trim()
}

function buildJSONLD(post: any, locale: ContentLocale, editorial: any, faqs: any[] = []): string {
  const prefix = locale === 'uk' ? 'ua' : locale
  const slug = post.publicSlug || post.slug
  const url = `https://navi.training/${prefix}/blog/${slug}/`
  const image = typeof post.image === 'object' ? post.image?.url : undefined
  const authors = (post.authors || []).flatMap((relation: any) => {
    const author = relation?.value || relation
    return author && typeof author === 'object' ? [{ '@type': 'Person', name: author.name, url: author.publicSlug || author.slug ? `https://navi.training/${prefix}/team/${author.publicSlug || author.slug}/` : undefined }] : []
  })
  const keywords = (post.tags || []).flatMap((relation: any) => {
    const tag = relation?.value || relation
    return tag && typeof tag === 'object' && tag.name ? [tag.name] : []
  })
  const graph: any[] = [{
    '@type': 'BlogPosting', '@id': `${url}#article`, headline: post.name, description: editorial.metaDescription || post.summary,
    inLanguage: locale, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, image: image ? [image] : undefined,
    author: authors.length ? authors : { '@type': 'Organization', name: 'Navi.training', url: 'https://navi.training/' },
    publisher: { '@type': 'Organization', name: 'Navi.training', url: 'https://navi.training/' },
    datePublished: post.createdAt, dateModified: post.updatedAt, keywords: keywords.length ? keywords : undefined,
  }]
  if (faqs.length) graph.push({
    '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: faqs.map((faq) => ({
      '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: lexicalPlainText(faq.answer) },
    })),
  })
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
}

export const localizePostTask: TaskConfig<any> = {
  slug: 'localize-post',
  label: 'Localize post, SEO and link plan',
  // A full editorial workflow is expensive and stageful. Retrying the entire
  // task after a provider error duplicated translations and link analysis.
  retries: 0,
  concurrency: { key: ({ input }: any) => `post:${input.postId}`, exclusive: true, supersedes: true },
  inputSchema: [
    { name: 'postId', type: 'number', required: true },
    { name: 'sourceLocale', type: 'select', required: true, options: CONTENT_LOCALES.map(({ code, label }) => ({ value: code, label })) },
    { name: 'targetLocales', type: 'select', hasMany: true, required: true, options: CONTENT_LOCALES.map(({ code, label }) => ({ value: code, label })) },
    { name: 'changedFields', type: 'select', hasMany: true, required: true, options: ['name', 'content', 'summary', 'image', 'faqs', 'authors', 'tags', 'publicationStatus'].map((value) => ({ label: value, value })) },
    { name: 'stages', type: 'select', hasMany: true, options: ['source-editorial', 'translations', 'taxonomy-links', 'image', 'social-images'].map((value) => ({ label: value, value })) },
    { name: 'fieldScope', type: 'select', options: ['all', 'seo', 'faq', 'alt'].map((value) => ({ label: value, value })) },
  ],
  outputSchema: [
    { name: 'completedLocales', type: 'select', hasMany: true, options: CONTENT_LOCALES.map(({ code, label }) => ({ value: code, label })) },
  ],
  handler: async ({ input, req }: any) => {
    const sourceLocale = input.sourceLocale as ContentLocale
    let currentStage = 'loading source article'
    try {
    const source = await req.payload.findByID({ collection: 'posts-new', id: input.postId, locale: sourceLocale, fallbackLocale: false, depth: 0 }) as any
    if (!source.name || !source.content) throw new Error(`Source locale ${sourceLocale} has no title or content`)
    currentStage = 'normalizing source Lexical content'
    source.content = normalizeLexicalRelations(source.content)
    source.localizationWorkflow = { ...(source.localizationWorkflow || {}), state: 'running', currentStage: 'Preparing the source article', lastError: null }
    await req.payload.update({
      collection: 'posts-new', id: input.postId, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: { content: source.content, localizationWorkflow: source.localizationWorkflow },
    })
    const reportStage = async (stage: string) => {
      currentStage = stage
      source.localizationWorkflow = { ...(source.localizationWorkflow || {}), state: 'running', currentStage: stage, lastError: null }
      await req.payload.update({
        collection: 'posts-new', id: source.id, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
        data: { localizationWorkflow: source.localizationWorkflow },
      })
    }
    const targets = [...new Set((input.targetLocales || []).filter((locale: string) => locale !== sourceLocale))] as ContentLocale[]
    const changed = new Set(input.changedFields || ['name', 'content', 'summary', 'image'])
    const stages = new Set(input.stages?.length ? input.stages : ['source-editorial', 'translations', 'taxonomy-links', 'image', 'social-images'])
    const fieldScope = (input.fieldScope || 'all') as 'all' | 'seo' | 'faq' | 'alt'
    const runSourceEditorial = stages.has('source-editorial')
    const runTranslations = stages.has('translations')
    const runTaxonomyLinks = stages.has('taxonomy-links')
    const runImage = stages.has('image')
    const runSocialImages = stages.has('social-images')
    const fullRun = runSourceEditorial && runTranslations && runTaxonomyLinks && runImage && runSocialImages
    const completed: ContentLocale[] = []

    // Candidate extraction is an enrichment step for the complete workflow. A translation-only
    // repair must not mutate the glossary or fail before it reaches the target locales.
    if (runTranslations && runSourceEditorial && (changed.has('content') || changed.has('name'))) {
      currentStage = 'learning glossary candidates'
      await learnGlossaryCandidates(req.payload, source, sourceLocale)
    }
    const selectedTagIds = runTaxonomyLinks ? await selectTags(req.payload, source, sourceLocale) : []
    if (selectedTagIds.length) {
      const selectedTags = selectedTagIds.map((value) => ({ relationTo: 'tags-new', value }))
      source.tags = selectedTags
      await req.payload.update({ collection: 'posts-new', id: source.id, context: { skipLocalizationWorkflow: true }, data: { tags: selectedTags } })
      const refreshed = await req.payload.findByID({ collection: 'posts-new', id: source.id, locale: sourceLocale, fallbackLocale: false, depth: 1 }) as any
      source.tags = refreshed.tags
    }
    if (runTaxonomyLinks) {
      await reportStage(`Indexing ${sourceLocale.toUpperCase()} article passages`)
      await syncPostLinkIndex(req.payload, source, sourceLocale)
    }
    if (runImage && source.localizationWorkflow?.imagePrompt && (!source.image || source.localizationWorkflow?.regenerateImage)) {
      await reportStage('Generating the hero image')
      const image = await generateHeroImage(req.payload, source.localizationWorkflow.imagePrompt, source.name)
      source.image = image
      source.localizationWorkflow = {
        ...source.localizationWorkflow, regenerateImage: false, generatedImageModel: imageModel(), lastImageGeneratedAt: new Date().toISOString(),
      }
      await req.payload.update({
        collection: 'posts-new', id: source.id, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
        data: { image: image.id, localizationWorkflow: source.localizationWorkflow },
      })
    }
    await reportStage('Preparing editorial fields for the source language')
    const sourceGlossary = await loadApprovedGlossary(req.payload, source.content, sourceLocale, sourceLocale)

    const sourceEditorial = runSourceEditorial && fieldScope !== 'faq'
      ? await generateEditorialFields({ content: source.content, locale: sourceLocale, name: source.name, summary: source.summary, glossary: sourceGlossary })
      : { summary: source.summary, seoTitle: source.seo?.title, metaDescription: source.seo?.meta_description, focusKeyphrase: source.seo?.focus_keyphrase, imageAlt: source.imageAlt }
    const existingSourceFAQs = validFAQs(source.faqs)
    const sourceFAQs = (runSourceEditorial && (fieldScope === 'all' || fieldScope === 'faq')) || (runTranslations && !existingSourceFAQs.length)
      ? await generateFAQs(source.content, sourceLocale, sourceGlossary)
      : existingSourceFAQs
    const sourceLinkPlan = runTaxonomyLinks ? await generateLinkPlan(req.payload, source, sourceLocale) : (source.localizationWorkflow?.linkPlan || [])
    const sourceInboundLinkPlan = runTaxonomyLinks ? await generateInboundLinkPlan(req.payload, source, sourceLocale) : (source.localizationWorkflow?.inboundLinkPlan || [])
    if (runTaxonomyLinks && source.publicationStatus === 'published') await applyInboundLinks(req.payload, sourceInboundLinkPlan, sourceLocale)
    const sourceContent = runTaxonomyLinks ? applyLinkPlan(source.content, sourceLinkPlan) : source.content
    if (runSourceEditorial && fieldScope === 'all') assertLocalizedResult({ locale: sourceLocale, post: { ...source, content: sourceContent }, editorial: sourceEditorial, faqs: sourceFAQs, linkPlan: sourceLinkPlan })
    const sourceJSONLD = buildJSONLD({ ...source, content: sourceContent }, sourceLocale, sourceEditorial, sourceFAQs)
    const generatedSourceKeywords = runSourceEditorial && fieldScope !== 'faq'
      ? buildGeneratedKeywords(sourceEditorial, sourceContent, sourceFAQs)
      : null
    if (generatedSourceKeywords && generatedSourceKeywords.keywords.length < 4) {
      throw new Error(`${sourceLocale}: fewer than four valid link keywords generated`)
    }
    await req.payload.update({
      collection: 'posts-new', id: source.id, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: {
        ...(runSourceEditorial && fieldScope === 'all' ? { summary: sourceEditorial.summary || source.summary } : {}),
        ...(runSourceEditorial && (fieldScope === 'all' || fieldScope === 'faq') ? { faqs: sourceFAQs } : {}),
        ...(runSourceEditorial && (fieldScope === 'all' || fieldScope === 'alt') ? { imageAlt: sourceEditorial.imageAlt } : {}),
        ...(runTaxonomyLinks ? { content: normalizeLexicalRelations(sourceContent) } : {}),
        ...((runTaxonomyLinks || (runSourceEditorial && ['all', 'seo', 'faq'].includes(fieldScope))) ? { seo: {
          ...(source.seo || {}),
          // FAQ-only generation refreshes FAQPage JSON-LD without erasing existing SEO fields.
          ...(fieldScope !== 'faq' ? {
            title: sourceEditorial.seoTitle,
            meta_description: sourceEditorial.metaDescription,
            focus_keyphrase: sourceEditorial.focusKeyphrase,
            ...(generatedSourceKeywords ? { link_keywords: serializeKeywords(generatedSourceKeywords.keywords) } : {}),
          } : {}),
          json_ld: sourceJSONLD,
        } } : {}),
        localizationWorkflow: { ...(source.localizationWorkflow || {}), linkPlan: sourceLinkPlan, inboundLinkPlan: sourceInboundLinkPlan },
      },
    })
    if (runTaxonomyLinks) await syncPostLinkIndex(req.payload, { ...source, content: sourceContent }, sourceLocale)
    if (generatedSourceKeywords) {
      await saveGeneratedKeywords(req.payload, source.id, sourceLocale, sourceEditorial.focusKeyphrase, generatedSourceKeywords)
    }
    completed.push(sourceLocale)

    if (runTranslations) for (const target of targets) {
      await reportStage(`Translating and preparing ${target.toUpperCase()}`)
      const current = await req.payload.findByID({ collection: 'posts-new', id: source.id, locale: target, fallbackLocale: false, depth: 0 }) as any
      currentStage = `${target}: loading approved glossary`
      const glossary = await loadApprovedGlossary(req.payload, source.content, sourceLocale, target)
      currentStage = `${target}: translating article content`
      const translatedContent = changed.has('content') || !current.content
        ? localizeInternalURLs(await translateLexical(source.content, sourceLocale, target, glossary), target)
        : current.content
      currentStage = `${target}: translating title`
      const translatedTitle = changed.has('name') || !current.name
        ? await openRouterJSON(`Translate this sailing article title from ${sourceLocale} to ${target}. ${YACHTING_GLOSSARY}\n${glossary} Return JSON {"title":"..."}.`, JSON.stringify({ title: source.name }))
        : { title: current.name }
      currentStage = `${target}: generating editorial and SEO fields`
      const editorial = await generateEditorialFields({ content: translatedContent, locale: target, name: translatedTitle.title || source.name, glossary })
      const localizedName = translatedTitle.title || editorial.title
      const localized = { ...source, id: source.id, content: translatedContent, name: localizedName, slug: current.slug || generateSlug(localizedName) }
      if (runTaxonomyLinks) {
        currentStage = `${target}: indexing translated article passages`
        await syncPostLinkIndex(req.payload, localized, target)
      }
      const linkPlan = runTaxonomyLinks ? await generateLinkPlan(req.payload, localized, target) : (current.localizationWorkflow?.linkPlan || [])
      const inboundLinkPlan = runTaxonomyLinks ? await generateInboundLinkPlan(req.payload, localized, target) : (current.localizationWorkflow?.inboundLinkPlan || [])
      if (runTaxonomyLinks && source.publicationStatus === 'published') await applyInboundLinks(req.payload, inboundLinkPlan, target)
      const linkedContent = runTaxonomyLinks ? applyLinkPlan(translatedContent, linkPlan) : translatedContent
      currentStage = `${target}: translating FAQs`
      const existingLocalizedFAQs = validFAQs(current.faqs)
      const localizedFAQs = changed.has('faqs') || !existingLocalizedFAQs.length ? await translateFAQs(sourceFAQs, sourceLocale, target, glossary) : existingLocalizedFAQs
      assertLocalizedResult({ locale: target, post: { ...localized, content: linkedContent }, editorial, faqs: localizedFAQs, linkPlan })
      const jsonLD = buildJSONLD({ ...localized, content: linkedContent, slug: generateSlug(localized.name) }, target, editorial, localizedFAQs)
      const generatedKeywords = buildGeneratedKeywords(editorial, linkedContent, localizedFAQs)
      if (generatedKeywords.keywords.length < 4) throw new Error(`${target}: fewer than four valid link keywords generated`)
      currentStage = `${target}: saving translated article and FAQs`
      await req.payload.update({
        collection: 'posts-new', id: source.id, locale: target, context: { skipLocalizationWorkflow: true },
        data: {
          name: localized.name,
          slug: generateSlug(localized.name),
          summary: changed.has('summary') || changed.has('content') || !current.summary ? editorial.summary : current.summary,
          content: normalizeLexicalRelations(linkedContent),
          faqs: localizedFAQs,
          imageAlt: editorial.imageAlt,
          seo: { title: editorial.seoTitle, meta_description: editorial.metaDescription, focus_keyphrase: editorial.focusKeyphrase, link_keywords: serializeKeywords(generatedKeywords.keywords), json_ld: jsonLD },
          localizationWorkflow: { ...(source.localizationWorkflow || {}), linkPlan, inboundLinkPlan },
        },
      })
      if (runTaxonomyLinks) await syncPostLinkIndex(req.payload, { ...localized, content: linkedContent }, target)
      currentStage = `${target}: saving link keywords`
      await saveGeneratedKeywords(req.payload, source.id, target, editorial.focusKeyphrase, generatedKeywords)
      completed.push(target)
    }

    if (runSocialImages) {
      const regenerate = Boolean(source.localizationWorkflow?.regenerateSocialImages)
      const socialLocales = [...new Set([sourceLocale, ...targets])] as ContentLocale[]
      for (const locale of socialLocales) {
        await reportStage(`Generating social images for ${locale.toUpperCase()}`)
        const localizedPost = await req.payload.findByID({ collection: 'posts-new', id: source.id, locale, fallbackLocale: false, depth: 0 }) as any
        const hasSocialImages = Boolean(localizedPost.socialImages?.thumbnail && localizedPost.socialImages?.image16x9 && localizedPost.socialImages?.image5x4)
        if (hasSocialImages && !regenerate) continue
        if (!localizedPost.name) throw new Error(`${locale}: title is required before generating social images`)
        const socialImages = await generatePostSocialImages(req.payload, localizedPost)
        await req.payload.update({
          collection: 'posts-new', id: source.id, locale, context: { skipLocalizationWorkflow: true },
          data: {
            socialImages: {
              thumbnail: socialImages.thumbnail.id,
              image16x9: socialImages.image16x9.id,
              image5x4: socialImages.image5x4.id,
            },
            seo: { ...(localizedPost.seo || {}), og_image: socialImages.image16x9.id },
          },
        })
      }
      source.localizationWorkflow = {
        ...source.localizationWorkflow,
        regenerateSocialImages: false,
        socialImageSourceLocale: socialLocales.join(', '),
        lastSocialImagesGeneratedAt: new Date().toISOString(),
      }
    }

    await req.payload.update({
      collection: 'posts-new', id: source.id, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: {
        publicationStatus: source.publicationStatus === 'published' ? 'published' : fullRun ? 'ready' : 'review',
        localizationWorkflow: {
          ...(source.localizationWorkflow || {}), state: 'review', completedLocales: completed,
          currentStage: 'Ready for the next editorial action', lastCompletedAt: new Date().toISOString(), lastError: null,
        },
      },
    })
    return { output: { completedLocales: completed } }
    } catch (error) {
      const failedPost = await req.payload.findByID({ collection: 'posts-new', id: input.postId, locale: sourceLocale, fallbackLocale: false, depth: 0 }).catch(() => null) as any
      const message = error instanceof Error ? error.message : String(error)
      await req.payload.update({
        collection: 'posts-new', id: input.postId, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
        data: { localizationWorkflow: { ...(failedPost?.localizationWorkflow || {}), state: 'failed', currentStage, lastError: `${currentStage}: ${message}`.slice(0, 1000) } },
      })
      throw error
    }
  },
}
