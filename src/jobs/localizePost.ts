import type { TaskConfig } from 'payload'

import { CONTENT_LOCALES, type ContentLocale, YACHTING_GLOSSARY } from '../config/contentLocales'
import { generateSlug } from '../utils/slug'

type LexicalNode = { type?: string; text?: string; children?: LexicalNode[]; [key: string]: unknown }

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

async function translateLexical(content: unknown, source: ContentLocale, target: ContentLocale): Promise<unknown> {
  const clone = structuredClone(content)
  const nodes = collectTextNodes(clone)
  for (let offset = 0; offset < nodes.length; offset += 35) {
    const batch = nodes.slice(offset, offset + 35)
    const translated = await openRouterJSON(
      `You are a professional sailing editor. Translate from ${source} to ${target}. ${YACHTING_GLOSSARY} Return only JSON {"items":{"id":"translation"}}. Preserve meaning, punctuation and inline spacing.`,
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

async function generateEditorialFields(args: { content: unknown; locale: ContentLocale; name: string; summary?: string }) {
  const plainText = collectTextNodes(structuredClone(args.content)).map(({ node }) => node.text).join(' ').slice(0, 24_000)
  return openRouterJSON(
    `You are an SEO editor for a professional sailing school. Write in ${args.locale}. ${YACHTING_GLOSSARY} Return JSON with title, summary, seoTitle, metaDescription, focusKeyphrase, imageAlt. SEO title 45-60 characters; description 135-160 characters; no keyword stuffing.`,
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

async function translateFAQs(faqs: any[], source: ContentLocale, target: ContentLocale): Promise<any[]> {
  return Promise.all((faqs || []).map(async (faq) => {
    const question = await openRouterJSON(
      `Translate this sailing FAQ question from ${source} to ${target}. ${YACHTING_GLOSSARY} Return JSON {"question":"..."}.`,
      JSON.stringify({ question: faq.question }),
    )
    return { ...faq, question: question.question, answer: await translateLexical(faq.answer, source, target) }
  }))
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
    { name: 'changedFields', type: 'select', hasMany: true, required: true, options: ['name', 'content', 'summary', 'image', 'faqs', 'authors', 'tags'].map((value) => ({ label: value, value })) },
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

    const sourceEditorial = await generateEditorialFields({ content: source.content, locale: sourceLocale, name: source.name, summary: source.summary })
    const sourceLinkPlan = await generateLinkPlan(req.payload, source, sourceLocale)
    const sourceContent = applyLinkPlan(source.content, sourceLinkPlan)
    const sourceJSONLD = buildJSONLD({ ...source, content: sourceContent }, sourceLocale, sourceEditorial, source.faqs)
    await req.payload.update({
      collection: 'posts-new', id: source.id, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: {
        summary: source.summary || sourceEditorial.summary,
        content: sourceContent,
        imageAlt: sourceEditorial.imageAlt,
        seo: { ...(source.seo || {}), title: source.seo?.title || sourceEditorial.seoTitle, meta_description: source.seo?.meta_description || sourceEditorial.metaDescription, focus_keyphrase: source.seo?.focus_keyphrase || sourceEditorial.focusKeyphrase, link_keywords: sourceLinkPlan.map((link: any) => `${link.anchor} -> ${link.url}`).join('\n'), json_ld: sourceJSONLD },
        localizationWorkflow: { ...(source.localizationWorkflow || {}), linkPlan: sourceLinkPlan },
      },
    })
    completed.push(sourceLocale)

    for (const target of targets) {
      const current = await req.payload.findByID({ collection: 'posts-new', id: source.id, locale: target, fallbackLocale: false, depth: 0 }) as any
      const translatedContent = changed.has('content') || !current.content
        ? localizeInternalURLs(await translateLexical(source.content, sourceLocale, target), target)
        : current.content
      const translatedTitle = changed.has('name') || !current.name
        ? await openRouterJSON(`Translate this sailing article title from ${sourceLocale} to ${target}. ${YACHTING_GLOSSARY} Return JSON {"title":"..."}.`, JSON.stringify({ title: source.name }))
        : { title: current.name }
      const editorial = await generateEditorialFields({ content: translatedContent, locale: target, name: translatedTitle.title || source.name })
      const localized = { ...source, id: source.id, content: translatedContent, name: translatedTitle.title || editorial.title }
      const linkPlan = await generateLinkPlan(req.payload, localized, target)
      const linkedContent = applyLinkPlan(translatedContent, linkPlan)
      const localizedFAQs = changed.has('faqs') || !current.faqs?.length ? await translateFAQs(source.faqs || [], sourceLocale, target) : current.faqs
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
          localizationWorkflow: { ...(source.localizationWorkflow || {}), linkPlan },
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
