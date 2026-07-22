import { getPayload } from 'payload'

import config from '../src/payload.config'
import { extractTextFromLexical } from '../src/utils/lexicalLinkAnalysis'

const token = process.env.OPENROUTER_TOKEN?.trim()
if (!token) throw new Error('OPENROUTER_TOKEN is required')
const model = process.env.OPENROUTER_GLOSSARY_MODEL?.trim() || 'google/gemini-3.6-flash'
const limit = Number(process.argv.find((value) => value.startsWith('--limit='))?.slice(8) || 60)
const concurrency = Number(process.argv.find((value) => value.startsWith('--concurrency='))?.slice(14) || 3)
const only = new Set((process.argv.find((value) => value.startsWith('--only='))?.slice(7) || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean))
const payload = await getPayload({ config })

const candidates = [
  ['anchor','anchoring'],['true wind','meteorology'],['port','sailing-basics'],['starboard','sailing-basics'],['bow','yacht-design'],['stern','yacht-design'],['hull','yacht-design'],['keel','yacht-design'],['rudder','yacht-handling'],['mast','sail-handling-trim'],
  ['boom','sail-handling-trim'],['mainsail','sail-handling-trim'],['jib','sail-handling-trim'],['genoa','sail-handling-trim'],['spinnaker','sail-handling-trim'],['halyard','sail-handling-trim'],['sheet','sail-handling-trim'],['shroud','yacht-equipment'],['stay','yacht-equipment'],['winch','yacht-equipment'],
  ['cleat','mooring'],['fender','mooring'],['mooring line','mooring'],['berth','mooring'],['marina','yacht-charter'],['gybe','sailing-basics'],['reefing','sail-handling-trim'],['close-hauled','sailing-theory'],['beam reach','sailing-theory'],['broad reach','sailing-theory'],
  ['running downwind','sailing-theory'],['windward','sailing-theory'],['leeward','sailing-theory'],['knot (speed)','navigation'],['nautical chart','navigation'],['magnetic compass','navigation'],['bearing','navigation'],['heading','navigation'],['course','navigation'],['waypoint','electronic-navigation'],
  ['latitude','navigation'],['longitude','navigation'],['depth sounder','electronic-navigation'],['GPS','electronic-navigation'],['AIS','electronic-navigation'],['marine radar','electronic-navigation'],['VHF marine radio','vhf-radio-communication'],['MAYDAY','vhf-radio-communication'],['PAN-PAN','vhf-radio-communication'],['EPIRB','life-saving-equipment'],
  ['life raft','life-saving-equipment'],['life jacket','life-saving-equipment'],['man overboard','safety-at-sea'],['COLREGs','collision-regulations'],['draught','yacht-design'],['displacement','yacht-design'],['catamaran','catamarans'],['monohull','sailing-yachts'],['heave-to','safety-at-sea'],['sea anchor','safety-at-sea'],
] as const

type Locale = 'ru' | 'uk' | 'en'
type Evidence = { id: number; title: string; url: string; excerpt: string }
const routeLocales: Record<Locale, string> = { ru: 'ru', uk: 'ua', en: 'en' }
const glossaryDomains = new Set(['general','sailing','navigation','meteorology','safety','radio','rigging','boatbuilding','racing','charter','certification'])

const tags = await payload.find({ collection: 'tags-new', locale: 'en', fallbackLocale: false, depth: 0, limit: 100 })
const tagBySlug = new Map(tags.docs.map((tag: any) => [tag.slug, tag.id]))
const postsByLocale = new Map<Locale, any[]>()
for (const locale of ['ru', 'uk', 'en'] as Locale[]) {
  const result = await payload.find({ collection: 'posts-new', locale, fallbackLocale: false, depth: 0, limit: 100 })
  postsByLocale.set(locale, result.docs)
}

function relationIds(values: any[] = []) {
  return values.map((value) => typeof value === 'object' && 'value' in value ? (typeof value.value === 'object' ? value.value.id : value.value) : (typeof value === 'object' ? value.id : value)).filter(Boolean)
}

function evidenceFor(locale: Locale, categoryId: number | undefined, key: string): Evidence[] {
  const posts = postsByLocale.get(locale) || []
  return posts.map((post) => {
    const text = `${post.name || ''}. ${post.summary || ''}. ${extractTextFromLexical(post.content)}`.replace(/\s+/g, ' ').trim()
    const score = (categoryId && relationIds(post.tags).includes(categoryId) ? 10 : 0) + (text.toLowerCase().includes(key.toLowerCase()) ? 5 : 0)
    return { score, id: post.id, title: post.name, url: `/${routeLocales[locale]}/blog/${post.publicSlug || post.slug}/`, excerpt: text.slice(0, 1800) }
  }).filter((item) => item.score > 0 && item.title && item.excerpt).sort((a, b) => b.score - a.score).slice(0, 3).map(({ score: _, ...item }) => item)
}

async function wikipediaEvidence(query: string) {
  const url = new URL('https://en.wikipedia.org/w/api.php')
  url.searchParams.set('action', 'query'); url.searchParams.set('generator', 'search'); url.searchParams.set('gsrsearch', `${query} sailing`); url.searchParams.set('gsrlimit', '1')
  url.searchParams.set('prop', 'extracts|info'); url.searchParams.set('exintro', '1'); url.searchParams.set('explaintext', '1'); url.searchParams.set('inprop', 'url'); url.searchParams.set('format', 'json'); url.searchParams.set('origin', '*')
  const response = await fetch(url, { headers: { 'User-Agent': 'Navi.training encyclopedia/1.0 (https://navi.training)' } })
  if (!response.ok) return null
  const body = await response.json() as any
  const page = Object.values(body.query?.pages || {})[0] as any
  return page?.extract ? { title: page.title, url: page.fullurl, excerpt: String(page.extract).slice(0, 2600) } : null
}

function validateTranslation(locale: Locale, item: any, allowedUrls: Set<string>) {
  if (!item?.term || !item?.slug || !item?.definition || !item?.encyclopediaText || !item?.seoTitle || !item?.seoDescription) throw new Error(`Incomplete ${locale} response`)
  const words = String(item.encyclopediaText).split(/\s+/).filter(Boolean).length
  if (words < 130 || words > 330) throw new Error(`${locale}: ${words} words`)
  const links = [...String(item.encyclopediaText).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1])
  const normalizeUrl = (url: string) => url.replace(/\/$/, '')
  const normalizedAllowed = new Set([...allowedUrls].map(normalizeUrl))
  if (links.length < 1 || links.length > 3 || links.some((url) => !normalizedAllowed.has(normalizeUrl(url)))) throw new Error(`${locale}: invalid internal links ${links.join(', ')}`)
  if (String(item.seoTitle).length > 65 || String(item.seoDescription).length < 100 || String(item.seoDescription).length > 170) throw new Error(`${locale}: invalid SEO lengths`)
}

async function generateOne([canonicalKey, categorySlug]: typeof candidates[number]) {
  const existing = await payload.find({ collection: 'glossary-terms', depth: 0, limit: 1, where: { canonicalKey: { equals: canonicalKey.toLowerCase() } } })
  if (existing.docs[0]?.release === 'published') return { key: canonicalKey, state: 'skipped-published' }
  const categoryId = tagBySlug.get(categorySlug) as number | undefined
  const evidence = Object.fromEntries((['ru', 'uk', 'en'] as Locale[]).map((locale) => [locale, evidenceFor(locale, categoryId, canonicalKey)])) as Record<Locale, Evidence[]>
  if ((['ru', 'uk', 'en'] as Locale[]).some((locale) => !evidence[locale].length)) throw new Error(`${canonicalKey}: insufficient article evidence`)
  const wiki = await wikipediaEvidence(canonicalKey)
  const allowedUrls = Object.fromEntries((['ru', 'uk', 'en'] as Locale[]).map((locale) => [locale, new Set([
    ...evidence[locale].map(({ url }) => url),
    `/${routeLocales[locale]}/tags/${categorySlug}/`,
  ])])) as Record<Locale, Set<string>>

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://navi.training', 'X-Title': 'Navi.training Yachting Encyclopedia' },
    body: JSON.stringify({ model, temperature: 0.15, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: `You edit “Navi.training Yachting Encyclopedia”. Write independent Russian, Ukrainian and English entries for one precise sailing concept. Each encyclopediaText must be 150–300 words, factually conservative and useful in practice. Define all measurements exactly and distinguish homonyms. Use Navi.training excerpts as house terminology and the supplied Wikipedia introduction only as an attributed factual reference. In EACH article insert 1–3 natural inline Markdown links chosen only from allowedInternalUrls. Prefer useful blog explanations; a topic tag is appropriate when it helps further exploration. Distribute links contextually, never collect them at the end. Return JSON {"domain":"...","translations":{"ru":{"term":"","slug":"","definition":"","encyclopediaText":"","usageNotes":"","seoTitle":"","seoDescription":"","imageAlt":""},"uk":{...},"en":{...}}}. Slugs are URL-safe Latin transliterations. SEO title <=60 chars; description 120–160 chars. Do not add external links or citations to prose.` },
      { role: 'user', content: JSON.stringify({ canonicalKey, category: categorySlug, naviEvidence: evidence, allowedInternalUrls: Object.fromEntries((['ru','uk','en'] as Locale[]).map((locale) => [locale, [...allowedUrls[locale]]])), wikipedia: wiki }) },
    ] }),
  })
  if (!response.ok) throw new Error(`${canonicalKey}: OpenRouter ${response.status} ${(await response.text()).slice(0, 400)}`)
  const body = await response.json() as any
  const generated = JSON.parse(body.choices?.[0]?.message?.content || '{}')
  const oldTranslations = existing.docs[0]?.translations || []
  const translations = (['ru', 'uk', 'en'] as Locale[]).map((locale) => {
    const item = generated.translations?.[locale]
    if (item?.encyclopediaText) {
      let linkIndex = 0
      item.encyclopediaText = String(item.encyclopediaText)
        .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\((\/(?:ru|ua|en)\/blog\/[^)]+)\)/g, (_match, anchor) => {
        const exactUrl = evidence[locale][Math.min(linkIndex, evidence[locale].length - 1)]?.url
        linkIndex += 1
        return exactUrl ? `[${anchor}](${exactUrl})` : anchor
        })
    }
    validateTranslation(locale, item, allowedUrls[locale])
    const old = oldTranslations.find((translation: any) => translation.locale === locale)
    return { ...item, locale, aliases: old?.aliases || [], forbiddenVariants: old?.forbiddenVariants || [], status: 'approved', provenance: 'agent', confidence: 0.8 }
  })
  const data: any = {
    canonicalKey: canonicalKey.toLowerCase(), domain: glossaryDomains.has(generated.domain) ? generated.domain : categorySlug === 'meteorology' ? 'meteorology' : categorySlug.includes('navigation') ? 'navigation' : categorySlug === 'vhf-radio-communication' ? 'radio' : ['safety-at-sea','life-saving-equipment','collision-regulations'].includes(categorySlug) ? 'safety' : categorySlug === 'yacht-design' ? 'boatbuilding' : 'sailing', status: 'approved', release: 'published', categories: categoryId ? [categoryId] : [], translations,
    sources: [
      ...Object.values(evidence).flat().map((article) => ({ name: `Navi.training: ${article.title}`, url: `https://navi.training${article.url}`, sourceRecordId: String(article.id), reusePolicy: 'ingest', retrievedAt: new Date().toISOString() })),
      ...(wiki ? [{ name: `Wikipedia: ${wiki.title}`, url: wiki.url, reusePolicy: 'attribution', license: 'CC BY-SA 4.0 / GFDL', retrievedAt: new Date().toISOString() }] : []),
    ],
    evidencePosts: [...new Set(Object.values(evidence).flat().map(({ id }) => id))], editorNotes: `Generated by ${model}; validate terminology, factual claims and inline links before approval.`,
  }
  if (existing.docs[0]) await payload.update({ collection: 'glossary-terms', id: existing.docs[0].id, data })
  else await payload.create({ collection: 'glossary-terms', data })
  return { key: canonicalKey, state: 'generated' }
}

const selected = (only.size ? candidates.filter(([key]) => only.has(key.toLowerCase())) : candidates).slice(0, Math.min(limit, candidates.length))
const failures: Array<{ key: string; error: string }> = []
let completed = 0
for (let offset = 0; offset < selected.length; offset += concurrency) {
  const batch = selected.slice(offset, offset + concurrency)
  const results = await Promise.all(batch.map(async (candidate) => {
    try { return await generateOne(candidate) }
    catch (error) { failures.push({ key: candidate[0], error: error instanceof Error ? error.message : String(error) }); return { key: candidate[0], state: 'failed' } }
  }))
  completed += batch.length
  console.log(`${completed}/${selected.length}: ${results.map(({ key, state }) => `${key}=${state}`).join(', ')}`)
}
console.log(JSON.stringify({ requested: selected.length, failures }, null, 2))
process.exit(failures.length ? 2 : 0)
