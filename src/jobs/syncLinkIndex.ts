import type { TaskConfig } from 'payload'

import { CONTENT_LOCALES, type ContentLocale } from '../config/contentLocales'
import { purgePostLinkIndex, syncPostLinkIndex } from '../utils/internalLinkRag'

export const syncLinkIndexTask: TaskConfig<any> = {
  slug: 'sync-link-index',
  label: 'Incrementally update the internal-link index',
  retries: 2,
  concurrency: { key: ({ input }: any) => `link-index:${input.postId}`, exclusive: true, supersedes: true },
  inputSchema: [
    { name: 'postId', type: 'number', required: true },
  ],
  outputSchema: [
    { name: 'indexedLocales', type: 'select', hasMany: true, options: CONTENT_LOCALES.map(({ code, label }) => ({ value: code, label })) },
    { name: 'passages', type: 'number' },
    { name: 'embedded', type: 'number' },
    { name: 'links', type: 'number' },
    { name: 'purged', type: 'checkbox' },
  ],
  handler: async ({ input, req }: any) => {
    const postId = Number(input.postId)
    let base: any
    try {
      base = await req.payload.findByID({
        collection: 'posts-new', id: postId, locale: 'ru', fallbackLocale: false, depth: 0,
      })
    } catch {
      // A deleted post is already removed by the database's ON DELETE CASCADE.
      return { output: { indexedLocales: [], passages: 0, embedded: 0, links: 0, purged: true } }
    }

    if (base.publicationStatus !== 'published') {
      await purgePostLinkIndex(req.payload, postId)
      return { output: { indexedLocales: [], passages: 0, embedded: 0, links: 0, purged: true } }
    }

    const indexedLocales: ContentLocale[] = []
    let passages = 0
    let embedded = 0
    let links = 0
    for (const { code: locale } of CONTENT_LOCALES) {
      const post = await req.payload.findByID({
        collection: 'posts-new', id: postId, locale, fallbackLocale: false, depth: 0,
      }) as any
      if (!post?.name || !post?.content) {
        await purgePostLinkIndex(req.payload, postId, locale)
        continue
      }
      const stats = await syncPostLinkIndex(req.payload, post, locale)
      indexedLocales.push(locale)
      passages += stats.indexed
      embedded += stats.embedded
      links += stats.links
    }
    return { output: { indexedLocales, passages, embedded, links, purged: false } }
  },
}
