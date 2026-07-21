import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { generateSlug } from '../src/utils/slug'

type Seed = { en: string; ru: string; provenance: 'txt-source' | 'pdf-source'; definition?: string }

const txtPath = process.argv.find((value) => value.startsWith('--txt='))?.slice(6)
const pdfPath = process.argv.find((value) => value.startsWith('--pdf='))?.slice(6)
const dryRun = process.argv.includes('--dry-run')
if (!txtPath && !pdfPath) throw new Error('Provide --txt=/path/glossary.txt and/or --pdf=/path/glossary.pdf')

const seeds: Seed[] = []
if (txtPath) {
  for (const line of fs.readFileSync(txtPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^(.+?)\s+[—–]\s+(.+)$/)
    if (!match || match[1].trim().length < 2) continue
    const en = match[2].split(/[,;]/)[0].trim()
    if (/^[A-Za-z][A-Za-z0-9 ()'’/~.-]{1,120}$/.test(en)) seeds.push({ ru: match[1].trim(), en, provenance: 'txt-source' })
  }
}
if (pdfPath) {
  const text = execFileSync('pdftotext', ['-raw', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 20_000_000 })
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^[A-Z]\s+(?=[a-z])/, '').trim()
    const match = line.match(/^([A-Za-z][A-Za-z0-9 ()'’~,./-]{1,120})\s+[—–]\s+(.+)$/)
    if (!match) continue
    seeds.push({ en: match[1].trim(), ru: match[2].trim().replace(/[.;]$/, ''), provenance: 'pdf-source' })
  }
}

const concepts = new Map<string, Seed[]>()
for (const seed of seeds) {
  const canonicalKey = generateSlug(seed.en.toLowerCase()).slice(0, 180)
  if (!canonicalKey) continue
  concepts.set(canonicalKey, [...(concepts.get(canonicalKey) || []), seed])
}
console.log(`Parsed ${seeds.length} entries into ${concepts.size} concepts${dryRun ? ' (dry run)' : ''}.`)
if (dryRun) process.exit(0)

const payload = await getPayload({ config })
let created = 0
let updated = 0
const upsertConcept = async ([canonicalKey, variants]: [string, Seed[]]) => {
  const found = await payload.find({ collection: 'glossary-terms', depth: 0, limit: 1, where: { canonicalKey: { equals: canonicalKey } } })
  const existing = found.docs[0] as any
  const enTerms = [...new Set(variants.map(({ en }) => en))]
  const ruTerms = [...new Set(variants.map(({ ru }) => ru))]
  const provenance = variants.some(({ provenance: value }) => value === 'pdf-source') ? 'pdf-source' : 'txt-source'
  if (!existing) {
    await payload.create({ collection: 'glossary-terms', data: {
      canonicalKey, domain: 'general', status: 'proposed', translations: [
        { locale: 'en', term: enTerms[0], aliases: enTerms.slice(1).map((value) => ({ value })), status: 'proposed', provenance, confidence: provenance === 'pdf-source' ? 0.8 : 0.65 },
        { locale: 'ru', term: ruTerms[0], aliases: ruTerms.slice(1).map((value) => ({ value })), status: 'proposed', provenance, confidence: provenance === 'pdf-source' ? 0.8 : 0.65 },
      ],
    } })
    created += 1
  } else {
    const translations = [...(existing.translations || [])]
    for (const [locale, terms] of [['en', enTerms], ['ru', ruTerms]] as const) {
      const current = translations.find((item: any) => item.locale === locale)
      if (!current) translations.push({ locale, term: terms[0], aliases: terms.slice(1).map((value) => ({ value })), status: 'proposed', provenance, confidence: 0.7 })
      else current.aliases = [...new Map([...(current.aliases || []), ...terms.filter((term) => term !== current.term).map((value) => ({ value }))].map((item: any) => [item.value, item])).values()]
    }
    await payload.update({ collection: 'glossary-terms', id: existing.id, data: { translations } })
    updated += 1
  }
}
const entries = [...concepts.entries()]
for (let offset = 0; offset < entries.length; offset += 20) {
  await Promise.all(entries.slice(offset, offset + 20).map(upsertConcept))
  if ((offset + 20) % 200 === 0) console.log(`Processed ${Math.min(offset + 20, entries.length)}/${entries.length}`)
}
console.log(`Glossary import complete: ${created} created, ${updated} merged.`)
process.exit(0)
