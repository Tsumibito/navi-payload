import { NextResponse } from 'next/server'

import { authenticatePayloadRequest, unauthorizedResponse } from '@/utils/authenticatedPayload'
import { generateSlug } from '@/utils/slug'

const DEFAULT_IMAGE_PROMPT = 'Photorealistic editorial hero image for a professional sailing article. Accurate modern yacht equipment and realistic seamanship context, natural light, clean 16:9 composition, no logos, brands, watermarks or readable interface text.'
type Action = 'editorial' | 'translations' | 'taxonomy' | 'image' | 'full' | 'publish'
const ACTION_STAGES: Record<Exclude<Action, 'publish'>, string[]> = {
  editorial: ['source-editorial'], translations: ['translations'], taxonomy: ['taxonomy-links'], image: ['image'],
  full: ['source-editorial', 'translations', 'taxonomy-links', 'image'],
}

async function publicationErrors(payload: any, postId: number | string) {
  const errors: string[] = []
  for (const locale of ['uk', 'ru', 'en']) {
    const post = await payload.findByID({ collection: 'posts-new', id: postId, locale, fallbackLocale: false, depth: 0 }) as any
    if (!post.name || !post.content || !post.summary) errors.push(`${locale}: title, content or summary missing`)
    if (!post.seo?.title || !post.seo?.meta_description || !post.seo?.json_ld) errors.push(`${locale}: SEO or JSON-LD missing`)
    if ((post.faqs || []).length < 4) errors.push(`${locale}: fewer than 4 FAQs`)
  }
  const base = await payload.findByID({ collection: 'posts-new', id: postId, locale: 'uk', fallbackLocale: false, depth: 0 }) as any
  if (!base.image) errors.push('Hero image missing')
  if (!(base.tags || []).length) errors.push('Tags missing')
  if (!(base.authors || []).length) errors.push('Author missing')
  return errors
}

export async function GET(request: Request) {
  const auth = await authenticatePayloadRequest(request)
  if (!auth) return unauthorizedResponse()
  const postId = new URL(request.url).searchParams.get('postId')
  if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  const post = await auth.payload.findByID({ collection: 'posts-new', id: postId, locale: 'uk', fallbackLocale: false, depth: 0 }) as any
  return NextResponse.json({ publicationStatus: post.publicationStatus, workflow: post.localizationWorkflow, errors: await publicationErrors(auth.payload, postId) })
}

export async function POST(request: Request) {
  const auth = await authenticatePayloadRequest(request)
  if (!auth) return unauthorizedResponse()
  try {
    const { postId, action = 'full' } = await request.json() as { postId?: number | string; action?: Action }
    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    if (!['editorial', 'translations', 'taxonomy', 'image', 'full', 'publish'].includes(action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    const { payload } = auth
    let post = await payload.findByID({ collection: 'posts-new', id: postId, locale: 'uk', fallbackLocale: false, depth: 0 }) as any

    // The legacy migration put the Ukrainian draft 27 into the RU locale.
    if (String(postId) === '27' && (!post.name || !post.content)) {
      const migrated = await payload.findByID({ collection: 'posts-new', id: postId, locale: 'ru', fallbackLocale: false, depth: 0 }) as any
      if (!migrated.name || !migrated.content) throw new Error('Post 27 has no migrated Ukrainian source')
      const title = 'GPS, AIS та радар: три «ока» вашої яхти — чи знаєте ви різницю?'
      post = await payload.update({
        collection: 'posts-new', id: postId, locale: 'uk', context: { skipLocalizationWorkflow: true },
        data: { name: title, slug: generateSlug(title), content: migrated.content, summary: null, faqs: [] },
      })
    }

    const sourceLocale = String(postId) === '27' ? 'uk' : (post.localizationWorkflow?.sourceLocale || 'uk')
    const source = sourceLocale === 'uk' ? post : await payload.findByID({ collection: 'posts-new', id: postId, locale: sourceLocale, fallbackLocale: false, depth: 0 }) as any
    if (!source.name || !source.content) return NextResponse.json({ error: `Source locale ${sourceLocale} has no title or content` }, { status: 400 })
    if (action === 'publish') {
      const errors = await publicationErrors(payload, postId)
      if (errors.length) return NextResponse.json({ error: 'Статья не готова к публикации', errors }, { status: 409 })
      await payload.update({ collection: 'posts-new', id: postId, locale: sourceLocale, context: { skipLocalizationWorkflow: true }, data: { publicationStatus: 'published' } })
      await payload.jobs.queue({ task: 'localize-post' as never, queue: 'content-localization', input: { postId: Number(postId), sourceLocale, targetLocales: ['uk', 'ru', 'en'], changedFields: ['publicationStatus'], stages: ['taxonomy-links'] } as never })
      return NextResponse.json({ published: true, postId })
    }
    const workflow = {
      ...(source.localizationWorkflow || {}), sourceLocale, targetLocales: ['uk', 'ru', 'en'], autoRun: true,
      imagePrompt: source.localizationWorkflow?.imagePrompt || DEFAULT_IMAGE_PROMPT,
      regenerateImage: Boolean(source.localizationWorkflow?.regenerateImage), state: 'queued', lastError: null,
    }
    await payload.update({
      collection: 'posts-new', id: postId, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: { publicationStatus: action === 'full' ? 'localizing' : 'review', localizationWorkflow: workflow },
    })
    const job = await payload.jobs.queue({
      task: 'localize-post' as never, queue: 'content-localization',
      input: { postId: Number(postId), sourceLocale, targetLocales: ['uk', 'ru', 'en'], changedFields: ['name', 'content', 'summary', 'image', 'faqs', 'authors', 'tags'], stages: ACTION_STAGES[action] } as never,
    })
    return NextResponse.json({ queued: true, jobId: (job as any)?.id, postId, sourceLocale, action })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Workflow failed to start' }, { status: 500 })
  }
}
