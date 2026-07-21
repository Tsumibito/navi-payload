import type { TaskConfig } from 'payload'

import { CONTENT_LOCALES, type ContentLocale, YACHTING_GLOSSARY } from '../config/contentLocales'
import { generateSlug } from '../utils/slug'

type LexicalNode = { type?: string; text?: string; children?: LexicalNode[]; [key: string]: unknown }
type GlossaryTranslation = { locale?: string; term?: string; aliases?: Array<{ value?: string }>; definition?: string; usageNotes?: string; forbiddenVariants?: Array<{ value?: string }>; status?: string }
const GLOSSARY_DOMAINS = new Set(['general', 'sailing', 'navigation', 'meteorology', 'safety', 'radio', 'rigging', 'boatbuilding', 'racing', 'charter', 'certification'])

const OPENROUTER_LOCALIZATION_MODEL = process.env.OPENROUTER_LOCALIZATION_MODEL?.trim() || 'openai/gpt-5.6-luna'

async function openRouterJSON(system: string, prompt: string): Promise<Record<string, any>> {
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
      model: OPENROUTER_LOCALIZATION_MODEL,
      temperature: 0.15,
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

async function translateLexical(content: unknown, source: ContentLocale, target: ContentLocale, glossary = ''): Promise<unknown> {
  const clone = structuredClone(content)
  const nodes = collectTextNodes(clone)
  for (let offset = 0; offset < nodes.length; offset += 35) {
    const batch = nodes.slice(offset, offset + 35)
    const translated = await openRouterJSON(
      `You are a professional sailing editor. Translate from ${source} to ${target}. ${YACHTING_GLOSSARY}\n${glossary} Return only JSON {"items":{"id":"translation"}}. Preserve meaning, punctuation and inline spacing.`,
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
    `You are an SEO editor for a professional sailing school. Write in ${args.locale}. ${YACHTING_GLOSSARY}\n${args.glossary || ''} Return JSON with title, summary, seoTitle, metaDescription, focusKeyphrase, imageAlt. SEO title 45-60 characters; description 135-160 characters; no keyword stuffing.`,
    JSON.stringify({ title: args.name, currentSummary: args.summary, article: plainText }),
  )
}

async function generateLinkPlan(payload: any, post: any, locale: ContentLocale) {
  const tagIds = (post.tags || []).map((tag: any) => typeof tag === 'object' ? tag.value?.id || tag.id || tag.value : tag)
  if (!tagIds.length) return []
  const candidates = await payload.find({
    collection: 'posts-new', locale, fallbackLocale: false, depth: 0, limit: 30,
    where: { and: [{ id: { not_equals: post.id } }, { publicationStatus: { equals: 'published' } }, { tags: { in: tagIds } }] },
  })
  const sourceText = collectTextNodes(structuredClone(post.content)).map(({ node }) => node.text).join(' ').slice(0, 20_000)
  const response = await openRouterJSON(
    `You design useful topic-cluster internal links for a sailing school. Select 2-6 genuinely relevant links, distributed through the article rather than grouped at the end. An anchor must be an exact natural phrase already present in the article. Avoid duplicate targets and commercial over-optimization. Return JSON {"links":[{"targetId":1,"anchor":"exact text","reason":"...","sectionHint":"..."}]}.`,
    JSON.stringify({ article: sourceText, candidates: candidates.docs.map((doc: any) => ({ id: doc.id, title: doc.name, slug: doc.publicSlug || doc.slug, summary: doc.summary })) }),
  )
  const byId = new Map(candidates.docs.map((doc: any) => [String(doc.id), doc]))
  const prefix = locale === 'uk' ? 'ua' : locale
  return (Array.isArray(response.links) ? response.links : []).flatMap((link: any) => {
    const target: any = byId.get(String(link.targetId))
    const slug = target?.publicSlug || target?.slug
    if (!target || !slug || typeof link.anchor !== 'string') return []
    return [{ ...link, targetId: target.id, url: `/${prefix}/blog/${slug}/` }]
  }).slice(0, 6)
}

async function generateInboundLinkPlan(payload: any, target: any, locale: ContentLocale) {
  const tagIds = (target.tags || []).map((tag: any) => typeof tag === 'object' ? tag.value?.id || tag.id || tag.value : tag)
  if (!tagIds.length) return []
  const candidates = await payload.find({
    collection: 'posts-new', locale, fallbackLocale: false, depth: 0, limit: 18,
    where: { and: [{ id: { not_equals: target.id } }, { publicationStatus: { equals: 'published' } }, { tags: { in: tagIds } }] },
  })
  const prefix = locale === 'uk' ? 'ua' : locale
  const targetSlug = target.publicSlug || target.slug
  if (!targetSlug) return []
  const targetURL = `/${prefix}/blog/${targetSlug}/`
  const sources = candidates.docs.flatMap((doc: any) => {
    const text = lexicalPlainText(doc.content)
    if (!text || JSON.stringify(doc.content).includes(targetURL)) return []
    return [{ id: doc.id, title: doc.name, summary: doc.summary, article: text.slice(0, 7_000) }]
  })
  if (!sources.length) return []
  const response = await openRouterJSON(
    `Select 2-5 published sailing articles that should link to the new target article. For every source choose one exact natural anchor phrase already present verbatim in that source article. The link must add genuine topical value and be distributed across the cluster. Return JSON {"links":[{"sourcePostId":1,"anchor":"exact phrase","reason":"..."}]}.`,
    JSON.stringify({ target: { title: target.name, summary: target.summary, url: targetURL }, sources }),
  )
  const byId = new Map(candidates.docs.map((doc: any) => [String(doc.id), doc]))
  return (Array.isArray(response.links) ? response.links : []).flatMap((link: any) => {
    const source: any = byId.get(String(link.sourcePostId))
    if (!source || typeof link.anchor !== 'string' || !lexicalPlainText(source.content).includes(link.anchor)) return []
    return [{ ...link, sourcePostId: source.id, sourceTitle: source.name, url: targetURL }]
  }).slice(0, 5)
}

async function applyInboundLinks(payload: any, plan: any[], locale: ContentLocale) {
  for (const link of plan) {
    const source = await payload.findByID({ collection: 'posts-new', id: link.sourcePostId, locale, fallbackLocale: false, depth: 0 })
    if (!source?.content || JSON.stringify(source.content).includes(link.url)) continue
    const content = applyLinkPlan(source.content, [{ anchor: link.anchor, url: link.url }])
    if (JSON.stringify(content) === JSON.stringify(source.content)) continue
    await payload.update({ collection: 'posts-new', id: source.id, locale, context: { skipLocalizationWorkflow: true }, data: { content } })
  }
}

function applyLinkPlan(content: unknown, links: any[]): unknown {
  const clone = structuredClone(content) as any
  const pending = links.filter((link) => link?.url && link?.anchor).map((link) => ({ ...link, applied: false }))
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
  retries: 2,
  concurrency: { key: ({ input }: any) => `post:${input.postId}`, exclusive: true, supersedes: true },
  inputSchema: [
    { name: 'postId', type: 'number', required: true },
    { name: 'sourceLocale', type: 'select', required: true, options: CONTENT_LOCALES.map(({ code, label }) => ({ value: code, label })) },
    { name: 'targetLocales', type: 'select', hasMany: true, required: true, options: CONTENT_LOCALES.map(({ code, label }) => ({ value: code, label })) },
    { name: 'changedFields', type: 'select', hasMany: true, required: true, options: ['name', 'content', 'summary', 'image', 'faqs', 'authors', 'tags', 'publicationStatus'].map((value) => ({ label: value, value })) },
  ],
  outputSchema: [
    { name: 'completedLocales', type: 'select', hasMany: true, options: CONTENT_LOCALES.map(({ code, label }) => ({ value: code, label })) },
  ],
  handler: async ({ input, req }: any) => {
    const sourceLocale = input.sourceLocale as ContentLocale
    try {
    const source = await req.payload.findByID({ collection: 'posts-new', id: input.postId, locale: sourceLocale, fallbackLocale: false, depth: 1 }) as any
    if (!source.name || !source.content) throw new Error(`Source locale ${sourceLocale} has no title or content`)
    await req.payload.update({
      collection: 'posts-new', id: input.postId, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: { localizationWorkflow: { ...(source.localizationWorkflow || {}), state: 'running', lastError: null } },
    })
    const targets = [...new Set((input.targetLocales || []).filter((locale: string) => locale !== sourceLocale))] as ContentLocale[]
    const changed = new Set(input.changedFields || ['name', 'content', 'summary', 'image'])
    const completed: ContentLocale[] = []

    if (changed.has('content') || changed.has('name')) await learnGlossaryCandidates(req.payload, source, sourceLocale)
    const sourceGlossary = await loadApprovedGlossary(req.payload, source.content, sourceLocale, sourceLocale)

    const sourceEditorial = await generateEditorialFields({ content: source.content, locale: sourceLocale, name: source.name, summary: source.summary, glossary: sourceGlossary })
    const sourceLinkPlan = await generateLinkPlan(req.payload, source, sourceLocale)
    const sourceInboundLinkPlan = await generateInboundLinkPlan(req.payload, source, sourceLocale)
    if (source.publicationStatus === 'published') await applyInboundLinks(req.payload, sourceInboundLinkPlan, sourceLocale)
    const sourceContent = applyLinkPlan(source.content, sourceLinkPlan)
    const sourceJSONLD = buildJSONLD({ ...source, content: sourceContent }, sourceLocale, sourceEditorial, source.faqs)
    await req.payload.update({
      collection: 'posts-new', id: source.id, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: {
        summary: source.summary || sourceEditorial.summary,
        content: sourceContent,
        imageAlt: sourceEditorial.imageAlt,
        seo: { ...(source.seo || {}), title: source.seo?.title || sourceEditorial.seoTitle, meta_description: source.seo?.meta_description || sourceEditorial.metaDescription, focus_keyphrase: source.seo?.focus_keyphrase || sourceEditorial.focusKeyphrase, link_keywords: sourceLinkPlan.map((link: any) => `${link.anchor} -> ${link.url}`).join('\n'), json_ld: sourceJSONLD },
        localizationWorkflow: { ...(source.localizationWorkflow || {}), linkPlan: sourceLinkPlan, inboundLinkPlan: sourceInboundLinkPlan },
      },
    })
    completed.push(sourceLocale)

    for (const target of targets) {
      const current = await req.payload.findByID({ collection: 'posts-new', id: source.id, locale: target, fallbackLocale: false, depth: 0 }) as any
      const glossary = await loadApprovedGlossary(req.payload, source.content, sourceLocale, target)
      const translatedContent = changed.has('content') || !current.content
        ? localizeInternalURLs(await translateLexical(source.content, sourceLocale, target, glossary), target)
        : current.content
      const translatedTitle = changed.has('name') || !current.name
        ? await openRouterJSON(`Translate this sailing article title from ${sourceLocale} to ${target}. ${YACHTING_GLOSSARY}\n${glossary} Return JSON {"title":"..."}.`, JSON.stringify({ title: source.name }))
        : { title: current.name }
      const editorial = await generateEditorialFields({ content: translatedContent, locale: target, name: translatedTitle.title || source.name, glossary })
      const localizedName = translatedTitle.title || editorial.title
      const localized = { ...source, id: source.id, content: translatedContent, name: localizedName, slug: current.slug || generateSlug(localizedName) }
      const linkPlan = await generateLinkPlan(req.payload, localized, target)
      const inboundLinkPlan = await generateInboundLinkPlan(req.payload, localized, target)
      if (source.publicationStatus === 'published') await applyInboundLinks(req.payload, inboundLinkPlan, target)
      const linkedContent = applyLinkPlan(translatedContent, linkPlan)
      const localizedFAQs = changed.has('faqs') || !current.faqs?.length ? await translateFAQs(source.faqs || [], sourceLocale, target, glossary) : current.faqs
      const jsonLD = buildJSONLD({ ...localized, content: linkedContent, slug: generateSlug(localized.name) }, target, editorial, localizedFAQs)
      await req.payload.update({
        collection: 'posts-new', id: source.id, locale: target, context: { skipLocalizationWorkflow: true },
        data: {
          name: localized.name,
          slug: generateSlug(localized.name),
          summary: changed.has('summary') || changed.has('content') || !current.summary ? editorial.summary : current.summary,
          content: linkedContent,
          faqs: localizedFAQs,
          imageAlt: editorial.imageAlt,
          seo: { title: editorial.seoTitle, meta_description: editorial.metaDescription, focus_keyphrase: editorial.focusKeyphrase, link_keywords: linkPlan.map((link: any) => `${link.anchor} -> ${link.url}`).join('\n'), json_ld: jsonLD },
          localizationWorkflow: { ...(source.localizationWorkflow || {}), linkPlan, inboundLinkPlan },
        },
      })
      completed.push(target)
    }

    await req.payload.update({
      collection: 'posts-new', id: source.id, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: {
        publicationStatus: source.publicationStatus === 'published' ? 'published' : 'review',
        localizationWorkflow: {
          ...(source.localizationWorkflow || {}), state: 'review', completedLocales: completed,
          lastCompletedAt: new Date().toISOString(), lastError: null,
        },
      },
    })
    return { output: { completedLocales: completed } }
    } catch (error) {
      const failedPost = await req.payload.findByID({ collection: 'posts-new', id: input.postId, locale: sourceLocale, fallbackLocale: false, depth: 0 }).catch(() => null) as any
      await req.payload.update({
        collection: 'posts-new', id: input.postId, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
        data: { localizationWorkflow: { ...(failedPost?.localizationWorkflow || {}), state: 'failed', lastError: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000) } },
      })
      throw error
    }
  },
}
