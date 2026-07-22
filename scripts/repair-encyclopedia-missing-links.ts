import { getPayload } from 'payload'

import config from '../src/payload.config'

const payload = await getPayload({ config })
const result = await payload.find({ collection: 'glossary-terms', depth: 0, limit: 0, where: { release: { equals: 'published' } } })
let repaired = 0

try {
  for (const term of result.docs as any[]) {
    const categoryId = (term.categories || []).map((value: any) => typeof value === 'object' ? value.id : value).find(Boolean)
    if (!categoryId) continue
    let changed = false
    const translations = []
    for (const translation of term.translations || []) {
      const content = String(translation.encyclopediaText || '')
      if (!content || /\[[^\]]+\]\(\/[^)]+\)/.test(content)) {
        translations.push(translation)
        continue
      }
      const locale = translation.locale as 'ru' | 'uk' | 'en'
      if (!['ru', 'uk', 'en'].includes(locale)) {
        translations.push(translation)
        continue
      }
      const tag = await payload.findByID({ collection: 'tags-new', id: categoryId, locale, fallbackLocale: false, depth: 0 }) as any
      const routeLocale = locale === 'uk' ? 'ua' : locale
      const route = `/${routeLocale}/tags/${tag.publicSlug || tag.slug}/`
      const preferred = String(translation.term || '').trim()
      const index = preferred ? content.toLocaleLowerCase(locale).indexOf(preferred.toLocaleLowerCase(locale)) : -1
      if (index < 0) {
        translations.push(translation)
        continue
      }
      const anchor = content.slice(index, index + preferred.length)
      translations.push({ ...translation, encyclopediaText: `${content.slice(0, index)}[${anchor}](${route})${content.slice(index + preferred.length)}` })
      changed = true
      repaired += 1
    }
    if (changed) await payload.update({ collection: 'glossary-terms', id: term.id, data: { translations } })
  }
  payload.logger.info({ repaired }, 'Repaired encyclopedia entries without internal links')
} finally {
  const closing = (payload.db as any)?.pool?.end?.()
  if (closing) await Promise.race([closing, new Promise((resolve) => setTimeout(resolve, 2_000))])
}

process.exit(0)
