import { NextResponse } from 'next/server'

import { authenticatePayloadRequest, unauthorizedResponse } from '@/utils/authenticatedPayload'
import { generateSlug } from '@/utils/slug'

const DEFAULT_IMAGE_PROMPT = 'Photorealistic editorial hero image for a professional sailing article. Accurate modern yacht equipment and realistic seamanship context, natural light, clean 16:9 composition, no logos, brands, watermarks or readable interface text.'

export async function POST(request: Request) {
  const auth = await authenticatePayloadRequest(request)
  if (!auth) return unauthorizedResponse()
  try {
    const { postId } = await request.json() as { postId?: number | string }
    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 })
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
    const workflow = {
      ...(source.localizationWorkflow || {}), sourceLocale, targetLocales: ['uk', 'ru', 'en'], autoRun: true,
      imagePrompt: source.localizationWorkflow?.imagePrompt || DEFAULT_IMAGE_PROMPT,
      regenerateImage: Boolean(source.localizationWorkflow?.regenerateImage), state: 'queued', lastError: null,
    }
    await payload.update({
      collection: 'posts-new', id: postId, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: { publicationStatus: 'localizing', localizationWorkflow: workflow },
    })
    const job = await payload.jobs.queue({
      task: 'localize-post' as never, queue: 'content-localization',
      input: { postId: Number(postId), sourceLocale, targetLocales: ['uk', 'ru', 'en'], changedFields: ['name', 'content', 'summary', 'image', 'faqs', 'authors', 'tags'] } as never,
    })
    return NextResponse.json({ queued: true, jobId: (job as any)?.id, postId, sourceLocale })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Workflow failed to start' }, { status: 500 })
  }
}
