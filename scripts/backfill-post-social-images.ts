import { getPayload } from 'payload'

import config from '../src/payload.config'
import { generatePostSocialImages } from '../src/utils/socialImages'

const write = process.argv.includes('--write')
const force = process.argv.includes('--force')
const payload = await getPayload({ config })
const result = await payload.find({ collection: 'posts-new', limit: 0, depth: 0, locale: 'ru', fallbackLocale: false })
const locales = ['ru', 'uk', 'en'] as const
const summary = { posts: result.totalDocs, localeSets: result.totalDocs * locales.length, generated: 0, ready: 0, missingFeaturedImage: [] as Array<string>, missingTitle: [] as Array<string>, failed: [] as Array<{ id: string; error: string }> }

for (const row of result.docs as any[]) {
  const sourceLocale = row.localizationWorkflow?.sourceLocale || 'ru'
  const generatedLocales: string[] = []
  for (const locale of locales) {
    const post = await payload.findByID({ collection: 'posts-new', id: row.id, locale, fallbackLocale: false, depth: 0 }) as any
    const key = `${post.id}:${locale}`
    const complete = Boolean(post.socialImages?.thumbnail && post.socialImages?.image16x9 && post.socialImages?.image5x4)
    if (complete && !force) {
      summary.ready += 1
      continue
    }
    if (!post.image) {
      summary.missingFeaturedImage.push(key)
      continue
    }
    if (!post.name) {
      summary.missingTitle.push(key)
      continue
    }
    if (!write) continue
    try {
      const socialImages = await generatePostSocialImages(payload, post)
      await payload.update({
        collection: 'posts-new', id: post.id, locale, context: { skipLocalizationWorkflow: true },
        data: {
          socialImages: {
            thumbnail: socialImages.thumbnail.id,
            image16x9: socialImages.image16x9.id,
            image5x4: socialImages.image5x4.id,
          },
          seo: { ...(post.seo || {}), og_image: socialImages.image16x9.id },
        },
      })
      generatedLocales.push(locale)
      summary.generated += 1
      console.log(`[social-images] generated post ${post.id} (${locale})`)
    } catch (error) {
      summary.failed.push({ id: key, error: error instanceof Error ? error.message : String(error) })
    }
  }
  if (write && generatedLocales.length) {
    const source = await payload.findByID({ collection: 'posts-new', id: row.id, locale: sourceLocale, fallbackLocale: false, depth: 0 }) as any
    await payload.update({
      collection: 'posts-new', id: row.id, locale: sourceLocale, context: { skipLocalizationWorkflow: true },
      data: { localizationWorkflow: {
        ...(source.localizationWorkflow || {}), regenerateSocialImages: false,
        socialImageSourceLocale: locales.join(', '), lastSocialImagesGeneratedAt: new Date().toISOString(),
      } },
    })
  }
}

console.log(JSON.stringify({ mode: write ? 'write' : 'dry-run', force, ...summary }, null, 2))
process.exit(summary.failed.length ? 1 : 0)
