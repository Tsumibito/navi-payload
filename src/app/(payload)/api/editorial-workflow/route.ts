import { NextResponse } from 'next/server'

import { authenticatePayloadRequest, unauthorizedResponse } from '@/utils/authenticatedPayload'
import { localizePostTask, normalizeLexicalRelations } from '@/jobs/localizePost'

const DEFAULT_IMAGE_PROMPT = 'Photorealistic editorial hero image for a professional sailing article. Accurate modern yacht equipment and realistic seamanship context, natural light, clean 16:9 composition, no logos, brands, watermarks or readable interface text.'
type Action = 'editorial' | 'seo' | 'faq' | 'alt' | 'translations' | 'taxonomy' | 'image' | 'social' | 'full' | 'publish' | 'deploy'
const ACTION_STAGES: Record<'editorial' | 'translations' | 'taxonomy' | 'image' | 'social' | 'full', string[]> = {
  editorial: ['source-editorial'], translations: ['translations'], taxonomy: ['taxonomy-links'], image: ['image'],
  social: ['social-images'],
  full: ['source-editorial', 'translations', 'taxonomy-links', 'image', 'social-images'],
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

function lexicalLinks(value: unknown): Array<{ anchor: string; url: string }> {
  const links: Array<{ anchor: string; url: string }> = []
  const text = (node: any): string => typeof node?.text === 'string'
    ? node.text
    : Array.isArray(node?.children) ? node.children.map(text).join('') : ''
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'link' || node.type === 'autolink') {
      const url = node.fields?.url || node.url
      const anchor = text(node).replace(/\s+/g, ' ').trim()
      if (anchor && typeof url === 'string') links.push({ anchor, url })
    }
    if (Array.isArray(node.children)) node.children.forEach(visit)
  }
  visit(value)
  return links
}

function secondaryKeywords(seo: any): string[] {
  const structured = Array.isArray(seo?.additional_fields?.keywords)
    ? seo.additional_fields.keywords.map((item: any) => item?.keyword)
    : []
  const legacy = typeof seo?.link_keywords === 'string' ? seo.link_keywords.split(',') : []
  return [...new Set([...structured, ...legacy].map((item) => String(item || '').trim()).filter(Boolean))]
}

async function publicationReadiness(payload: any, postId: number | string) {
  const errors: string[] = []
  const warnings: string[] = []
  const locales: Record<string, { internalLinks: number; keywords: number; linkedKeywords: number }> = {}
  const social: Record<string, boolean> = {}
  let hero = false
  for (const locale of ['uk', 'ru', 'en']) {
    const post = await payload.findByID({ collection: 'posts-new', id: postId, locale, fallbackLocale: false, depth: 0 }) as any
    hero ||= Boolean(post.image)
    social[locale] = Boolean(post.socialImages?.thumbnail && post.socialImages?.image16x9 && post.socialImages?.image5x4)
    if (!post.name || !post.content || !post.summary) errors.push(`${locale}: title, content or summary missing`)
    if (!post.slug) errors.push(`${locale}: slug missing`)
    if (!post.imageAlt) errors.push(`${locale}: image alt missing`)
    if (!post.seo?.title || !post.seo?.meta_description || !post.seo?.json_ld) errors.push(`${locale}: SEO or JSON-LD missing`)
    if (!post.seo?.focus_keyphrase) errors.push(`${locale}: focus keyphrase missing`)
    if (post.seo?.no_index) errors.push(`${locale}: no_index is enabled`)
    if (validFAQs(post.faqs).length < 4) errors.push(`${locale}: fewer than 4 valid FAQs`)
    if (!social[locale]) errors.push(`${locale}: social images missing`)
    const links = lexicalLinks(post.content)
    const internalLinks = links.filter(({ url }) => /^\/(ru|ua|en)\//.test(url) || /^(https?:\/\/)?(www\.)?navi\.training\//i.test(url))
    const keywords = secondaryKeywords(post.seo)
    const linkedKeywords = keywords.filter((keyword) => internalLinks.some(({ anchor }) => anchor.toLocaleLowerCase(locale).includes(keyword.toLocaleLowerCase(locale))))
    locales[locale] = { internalLinks: internalLinks.length, keywords: keywords.length, linkedKeywords: linkedKeywords.length }
    if (internalLinks.length < 2) warnings.push(`${locale}: only ${internalLinks.length} internal links`)
    if (!keywords.length) errors.push(`${locale}: secondary link keywords missing`)
    else if (linkedKeywords.length < keywords.length) warnings.push(`${locale}: ${keywords.length - linkedKeywords.length}/${keywords.length} secondary keywords are not used in link anchors`)
  }
  const base = await payload.findByID({ collection: 'posts-new', id: postId, locale: 'uk', fallbackLocale: false, depth: 0 }) as any
  if (!base.image) errors.push('Hero image missing')
  if (!(base.tags || []).length) errors.push('Tags missing')
  if (!(base.authors || []).length) errors.push('Author missing')
  return { errors, warnings, locales, assets: { hero, social } }
}

export async function GET(request: Request) {
  const auth = await authenticatePayloadRequest(request)
  if (!auth) return unauthorizedResponse()
  const postId = new URL(request.url).searchParams.get('postId')
  if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  const post = await auth.payload.findByID({ collection: 'posts-new', id: postId, locale: 'uk', fallbackLocale: false, depth: 0 }) as any
  const readiness = await publicationReadiness(auth.payload, postId)
  return NextResponse.json(
    { publicationStatus: post.publicationStatus, workflow: post.localizationWorkflow, ...readiness },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

export async function POST(request: Request) {
  const auth = await authenticatePayloadRequest(request)
  if (!auth) return unauthorizedResponse()
  try {
    const { postId, action = 'full', locale: requestedLocale } = await request.json() as { postId?: number | string; action?: Action; locale?: string }
    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    if (!['editorial', 'seo', 'faq', 'alt', 'translations', 'taxonomy', 'image', 'social', 'full', 'publish', 'deploy'].includes(action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    const { payload } = auth
    const post = await payload.findByID({ collection: 'posts-new', id: postId, locale: 'uk', fallbackLocale: false, depth: 0 }) as any

    if (action === 'deploy') {
      if (post.publicationStatus !== 'published') return NextResponse.json({ error: 'Сначала опубликуйте статью' }, { status: 409 })
      const hook = process.env.CLOUDFLARE_PAGES_DEPLOY_HOOK?.trim()
      if (!hook) return NextResponse.json({ error: 'CLOUDFLARE_PAGES_DEPLOY_HOOK is not configured' }, { status: 503 })
      const response = await fetch(hook, { method: 'POST', body: '' })
      if (!response.ok) return NextResponse.json({ error: `Cloudflare deploy hook failed (${response.status})` }, { status: 502 })
      return NextResponse.json({ deployed: true, postId, cloudflare: await response.json().catch(() => null) })
    }

    const normalizedRequestedLocale = requestedLocale === 'ua' ? 'uk' : requestedLocale
    // Article 27 was authored in Russian. Older workflow code incorrectly marked it as Ukrainian.
    // Keep the explicit repair until the corrected value has been persisted by this request.
    const configuredSourceLocale = String(postId) === '27' ? 'ru' : (post.localizationWorkflow?.sourceLocale || 'ru')
    const sourceLocale = ['editorial', 'seo', 'faq', 'alt', 'taxonomy'].includes(action) && ['ru', 'uk', 'en'].includes(normalizedRequestedLocale || '')
      ? normalizedRequestedLocale as 'ru' | 'uk' | 'en'
      : configuredSourceLocale
    const source = sourceLocale === 'uk' ? post : await payload.findByID({ collection: 'posts-new', id: postId, locale: sourceLocale, fallbackLocale: false, depth: 0 }) as any
    if (!source.name || !source.content) return NextResponse.json({ error: `Source locale ${sourceLocale} has no title or content` }, { status: 400 })
    if (action === 'publish') {
      const { errors } = await publicationReadiness(payload, postId)
      if (errors.length) return NextResponse.json({ error: 'Статья не готова к публикации', errors }, { status: 409 })
      await payload.update({ collection: 'posts-new', id: postId, locale: 'uk', context: { skipLocalizationWorkflow: true }, data: { publicationStatus: 'published' } })
      return NextResponse.json({ published: true, postId })
    }
    const workflow = {
      ...(source.localizationWorkflow || {}), sourceLocale, targetLocales: ['uk', 'ru', 'en'], autoRun: true,
      imagePrompt: source.localizationWorkflow?.imagePrompt || DEFAULT_IMAGE_PROMPT,
      regenerateImage: action === 'image' || Boolean(source.localizationWorkflow?.regenerateImage), state: 'queued', currentStage: 'Queued — waiting for the worker', lastError: null,
      regenerateSocialImages: action === 'social' || Boolean(source.localizationWorkflow?.regenerateSocialImages),
    }
    const cleanedFAQs = validFAQs(source.faqs)
    await payload.update({
      collection: 'posts-new', id: postId, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: {
        publicationStatus: action === 'full' ? 'localizing' : 'review',
        localizationWorkflow: workflow,
        content: normalizeLexicalRelations(source.content) as any,
        // Repair stale empty array rows left by the former FAQ generator. Payload validates
        // required nested fields even when an unrelated SEO field is being updated.
        ...(cleanedFAQs.length !== (source.faqs || []).length ? { faqs: cleanedFAQs } : {}),
      },
    })
    const stages = ['seo', 'faq', 'alt'].includes(action) ? ['source-editorial'] : ACTION_STAGES[action as keyof typeof ACTION_STAGES]
    const fieldScope = ['seo', 'faq', 'alt'].includes(action) ? action : 'all'
    const taskInput = { postId: Number(postId), sourceLocale, targetLocales: ['uk', 'ru', 'en'], changedFields: ['name', 'content', 'summary', 'image', 'faqs', 'authors', 'tags'], stages, fieldScope }
    if (['editorial', 'seo', 'faq', 'alt', 'taxonomy'].includes(action)) {
      const handler = localizePostTask.handler as any
      await handler({ input: taskInput, req: { payload } })
      return NextResponse.json({ completed: true, postId, sourceLocale, action })
    }
    const job = await payload.jobs.queue({
      task: 'localize-post' as never, queue: 'content-localization',
      input: taskInput as never,
    })
    void payload.jobs.run({ queue: 'content-localization', limit: 1 }).catch((error) => payload.logger.error({ err: error }, 'Editorial worker failed'))
    return NextResponse.json({ queued: true, jobId: (job as any)?.id, postId, sourceLocale, action })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Workflow failed to start' }, { status: 500 })
  }
}
