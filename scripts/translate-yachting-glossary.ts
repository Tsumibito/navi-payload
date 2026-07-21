import { getPayload } from 'payload'

import config from '../src/payload.config'

const token = process.env.OPENROUTER_TOKEN?.trim()
if (!token) throw new Error('OPENROUTER_TOKEN is required')
const model = process.env.OPENROUTER_LOCALIZATION_MODEL?.trim() || 'openai/gpt-5.6-luna'
const targets = (process.argv.find((value) => value.startsWith('--locales='))?.slice(10) || 'uk,fr,es,de,pl').split(',').map((value) => value.trim()).filter(Boolean)
const limit = Number(process.argv.find((value) => value.startsWith('--limit='))?.slice(8) || 0)
const dryRun = process.argv.includes('--dry-run')
const payload = await getPayload({ config })
const result = await payload.find({ collection: 'glossary-terms', depth: 0, limit: 0, sort: 'id' })
const pending = result.docs.filter((doc: any) => {
  const locales = new Set((doc.translations || []).map((item: any) => item.locale))
  return targets.some((locale) => !locales.has(locale))
}).slice(0, limit || undefined) as any[]

console.log(`${pending.length} concepts need at least one of: ${targets.join(', ')}${dryRun ? ' (dry run)' : ''}.`)
if (dryRun) process.exit(0)

for (let offset = 0; offset < pending.length; offset += 40) {
  const batch = pending.slice(offset, offset + 40)
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://payload.navi.training', 'X-Title': 'Navi.training glossary enrichment' },
    body: JSON.stringify({
      model, temperature: 0.1, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `You are a professional multilingual sailing terminologist. Translate concepts into ${targets.join(', ')} using established maritime and yachting vocabulary, not literal generic wording. Keep ISSA/RYA certificate names unchanged. Return JSON {"items":[{"id":1,"translations":{"uk":"...","fr":"..."},"definition":"short English definition","notes":{"uk":"optional usage note"}}]}. Suggestions will be reviewed by an editor.` },
        { role: 'user', content: JSON.stringify(batch.map((doc) => ({ id: doc.id, canonicalKey: doc.canonicalKey, known: Object.fromEntries((doc.translations || []).map((item: any) => [item.locale, item.term])) }))) },
      ],
    }),
  })
  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 500)}`)
  const body = await response.json() as any
  const generated = JSON.parse(body.choices?.[0]?.message?.content || '{}')
  const byId = new Map((generated.items || []).map((item: any) => [String(item.id), item]))
  for (const doc of batch) {
    const item: any = byId.get(String(doc.id))
    if (!item?.translations) continue
    const existingLocales = new Set((doc.translations || []).map((value: any) => value.locale))
    const additions = targets.flatMap((locale) => !existingLocales.has(locale) && typeof item.translations[locale] === 'string' && item.translations[locale].trim()
      ? [{ locale, term: item.translations[locale].trim(), definition: item.definition, usageNotes: item.notes?.[locale], status: 'proposed', provenance: 'agent', confidence: 0.72 }]
      : [])
    if (additions.length) await payload.update({ collection: 'glossary-terms', id: doc.id, data: { translations: [...(doc.translations || []), ...additions] } })
  }
  console.log(`Translated ${Math.min(offset + batch.length, pending.length)}/${pending.length}`)
}
process.exit(0)
