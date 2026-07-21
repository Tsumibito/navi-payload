import { getPayload } from 'payload'

import config from '../src/payload.config'
import { localizePostTask } from '../src/jobs/localizePost'
import { generateSlug } from '../src/utils/slug'

const POST_ID = 27
const SOURCE_LOCALE = 'uk' as const
const payload = await getPayload({ config })

if (process.env.OPENROUTER_LOCALIZATION_MODEL !== 'google/gemini-3.6-flash') {
  throw new Error('Run with OPENROUTER_LOCALIZATION_MODEL=google/gemini-3.6-flash')
}

const migratedSource = await payload.findByID({
  collection: 'posts-new', id: POST_ID, locale: 'ru', fallbackLocale: false, depth: 1,
}) as any
if (!migratedSource?.content || !migratedSource?.name) throw new Error('Post 27 has no migrated source content')

const title = 'GPS, AIS та радар: три «ока» вашої яхти — чи знаєте ви різницю?'
const tagResult = await payload.find({
  collection: 'tags-new', locale: 'en', fallbackLocale: false, depth: 0, limit: 100,
  where: { slug: { in: ['electronic-navigation', 'navigation', 'safety-at-sea'] } },
})
const tagIds = tagResult.docs.map((tag: any) => tag.id)
if (!tagIds.length) throw new Error('No relevant navigation tags found')

await payload.update({
  collection: 'posts-new', id: POST_ID, locale: SOURCE_LOCALE,
  context: { skipLocalizationWorkflow: true },
  data: {
    name: title,
    slug: generateSlug(title),
    content: migratedSource.content,
    summary: null,
    faqs: [],
    image: null,
    authors: migratedSource.authors,
    tags: tagIds,
    publicationStatus: 'localizing',
    localizationWorkflow: {
      ...(migratedSource.localizationWorkflow || {}),
      sourceLocale: SOURCE_LOCALE,
      targetLocales: ['uk', 'ru', 'en'],
      autoRun: false,
      imagePrompt: 'Photorealistic view from a modern cruising yacht navigation station at blue hour. Clearly show three distinct realistic instruments working together: a nautical chartplotter/GPS route display, an AIS target display, and a marine radar with range rings. Open sea and one distant vessel through the windshield. Professional safety-focused editorial photography, natural teal and amber light, no people, no logos, no brands, no watermarks, no readable words or numbers.',
      regenerateImage: true,
      state: 'running',
      completedLocales: [],
      lastError: null,
    },
  },
})

const handler = localizePostTask.handler
if (!handler) throw new Error('Localization task has no handler')
await handler({
  input: {
    postId: POST_ID,
    sourceLocale: SOURCE_LOCALE,
    targetLocales: ['uk', 'ru', 'en'],
    changedFields: ['name', 'content', 'summary', 'image', 'faqs', 'authors', 'tags'],
  },
  req: { payload },
} as any)

const processed = await payload.findByID({ collection: 'posts-new', id: POST_ID, locale: SOURCE_LOCALE, fallbackLocale: false, depth: 0 }) as any
await payload.update({
  collection: 'posts-new', id: POST_ID, locale: SOURCE_LOCALE,
  context: { skipLocalizationWorkflow: true },
  data: {
    publicationStatus: 'ready',
    localizationWorkflow: {
      ...(processed.localizationWorkflow || {}),
      sourceLocale: SOURCE_LOCALE,
      targetLocales: ['uk', 'ru', 'en'],
      autoRun: true,
      state: 'review',
      completedLocales: ['uk', 'ru', 'en'],
      lastCompletedAt: new Date().toISOString(),
      lastError: null,
    },
  },
})

console.log(JSON.stringify({ postId: POST_ID, tagIds, status: 'ready' }))
process.exit(0)
