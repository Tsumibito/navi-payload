import { getPayload } from 'payload'

import config from '../src/payload.config'

const only = new Set(
  (process.argv.find((value) => value.startsWith('--only='))?.slice(7) || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
)
const approveAll = process.argv.includes('--all')
const unpublish = process.argv.includes('--unpublish')
if (!only.size && !approveAll) {
  throw new Error('Refusing bulk approval: pass --only=term-one,term-two or explicit --all')
}

const payload = await getPayload({ config })
const result = await payload.find({ collection: 'glossary-terms', limit: 0, depth: 0 })
let updated = 0
const skipped: string[] = []
const selected = (result.docs as any[]).filter((doc) => approveAll || only.has(String(doc.canonicalKey).toLowerCase()))
if (only.size && selected.length !== only.size) {
  const found = new Set(selected.map((doc) => String(doc.canonicalKey).toLowerCase()))
  throw new Error(`Unknown --only concepts: ${[...only].filter((key) => !found.has(key)).join(', ')}`)
}

if (unpublish) {
  for (const doc of selected) {
    const translations = (doc.translations || []).map((translation: any) => ({ ...translation, status: 'proposed' }))
    await payload.update({
      collection: 'glossary-terms', id: doc.id,
      data: { status: 'proposed', release: 'mvp', translations },
    })
    updated += 1
  }
  console.log(JSON.stringify({ selected: selected.length, unpublished: updated }, null, 2))
  process.exit(0)
}

const routeOwners = new Map<string, string>()
for (const doc of result.docs as any[]) {
  if (selected.some((candidate) => candidate.id === doc.id)) continue
  if (doc.status !== 'approved' || doc.release !== 'published') continue
  for (const translation of doc.translations || []) {
    if (translation.status !== 'approved' || !translation.slug) continue
    routeOwners.set(`${translation.locale}:${translation.slug}`, doc.canonicalKey)
  }
}
for (const doc of selected) {
  for (const translation of doc.translations || []) {
    const routeKey = `${translation.locale}:${translation.slug}`
    const owner = routeOwners.get(routeKey)
    if (owner && owner !== doc.canonicalKey) throw new Error(`${doc.canonicalKey}: duplicate encyclopedia route ${routeKey} owned by ${owner}`)
    routeOwners.set(routeKey, doc.canonicalKey)
  }
}

function validateTranslation(canonicalKey: string, translation: any) {
  const locale = String(translation?.locale || '')
  if (!['ru', 'uk', 'en'].includes(locale)) throw new Error(`${canonicalKey}: unsupported locale ${locale}`)
  for (const field of ['term', 'slug', 'definition', 'encyclopediaText', 'seoTitle', 'seoDescription']) {
    if (!String(translation?.[field] || '').trim()) throw new Error(`${canonicalKey}/${locale}: missing ${field}`)
  }
  const words = String(translation.encyclopediaText).split(/\s+/).filter(Boolean).length
  if (words < 130 || words > 330) throw new Error(`${canonicalKey}/${locale}: ${words} encyclopedia words`)
  const links = [...String(translation.encyclopediaText).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1])
  if (links.length < 1 || links.length > 3 || links.some((url) => !/^\/(?:ru|ua|en)\/(?:blog|tags|encyclopedia)\//.test(url))) {
    throw new Error(`${canonicalKey}/${locale}: invalid internal links ${links.join(', ')}`)
  }
  if (String(translation.seoTitle).length > 65) throw new Error(`${canonicalKey}/${locale}: SEO title too long`)
  const descriptionLength = String(translation.seoDescription).length
  if (descriptionLength < 100 || descriptionLength > 170) throw new Error(`${canonicalKey}/${locale}: invalid SEO description length`)
}

for (const doc of selected) {
  for (const translation of doc.translations || []) validateTranslation(doc.canonicalKey, translation)
  const translations = (doc.translations || []).map((translation: any) =>
    translation.encyclopediaText?.trim() ? { ...translation, status: 'approved' } : translation,
  )
  const complete = ['ru', 'uk', 'en'].every((locale) =>
    translations.some((translation: any) => translation.locale === locale && translation.encyclopediaText?.trim()),
  )
  if (!complete) {
    skipped.push(doc.canonicalKey)
    continue
  }
  const needsUpdate = doc.status !== 'approved' || doc.release !== 'published' ||
    translations.some((translation: any) => translation.encyclopediaText?.trim() && translation.status !== 'approved')
  if (!needsUpdate) continue
  await payload.update({
    collection: 'glossary-terms', id: doc.id,
    data: { status: 'approved', release: 'published', translations },
  })
  updated += 1
}

const verified = await payload.find({
  collection: 'glossary-terms', limit: 0, depth: 0,
  where: { and: [{ status: { equals: 'approved' } }, { release: { equals: 'published' } }] },
})
console.log(JSON.stringify({ totalConcepts: result.totalDocs, updated, approvedAndPublished: verified.totalDocs, skippedIncompleteCount: skipped.length }, null, 2))
process.exit(0)
