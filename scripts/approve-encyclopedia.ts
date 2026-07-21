import { getPayload } from 'payload'

import config from '../src/payload.config'

const payload = await getPayload({ config })
const result = await payload.find({ collection: 'glossary-terms', limit: 0, depth: 0 })
let updated = 0
const skipped: string[] = []

for (const doc of result.docs as any[]) {
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
