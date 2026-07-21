import { getPayload } from 'payload'

import config from '../src/payload.config'
import { extractTextFromLexical } from '../src/utils/lexicalLinkAnalysis'

const token = process.env.OPENROUTER_TOKEN?.trim()
if (!token) throw new Error('OPENROUTER_TOKEN is required')

const model = process.env.OPENROUTER_GLOSSARY_MODEL?.trim() || 'deepseek/deepseek-v4-flash'
const publish = process.argv.includes('--publish')
const payload = await getPayload({ config })

const concepts = [
  { canonicalKey: 'apparent wind', category: 'meteorology', queries: { en: 'apparent wind sailing', ru: 'вымпельный ветер', uk: 'вимпельний вітер' } },
  { canonicalKey: 'tack', category: 'sailing-basics', queries: { en: 'tack sailing', ru: 'галс парусное судно', uk: 'галс вітрильне судно' } },
  { canonicalKey: 'nautical mile', category: 'navigation', queries: { en: 'nautical mile', ru: 'морская миля', uk: 'морська миля' } },
] as const

type Locale = keyof typeof concepts[number]['queries']

function excerpt(text: string, query: string, radius = 900): string {
  const normalized = text.toLocaleLowerCase()
  const words = query.toLocaleLowerCase().split(/\s+/)
  const index = words.map((word) => normalized.indexOf(word)).find((value) => value >= 0) ?? -1
  if (index < 0) return ''
  return text.slice(Math.max(0, index - radius), index + radius).replace(/\s+/g, ' ').trim()
}

async function articleEvidence(locale: Locale, query: string) {
  const result = await payload.find({ collection: 'posts-new', locale, fallbackLocale: false, depth: 0, limit: 100 })
  return result.docs.flatMap((post: any) => {
    const text = extractTextFromLexical(post.content)
    const match = excerpt(`${post.name || ''}. ${post.summary || ''}. ${text}`, query)
    return match ? [{ title: post.name, url: `https://navi.training/${locale === 'uk' ? 'ua' : locale}/blog/${post.publicSlug || post.slug}`, excerpt: match }] : []
  }).slice(0, 3)
}

async function wikipediaEvidence(locale: Locale, query: string) {
  const url = new URL(`https://${locale}.wikipedia.org/w/api.php`)
  url.searchParams.set('action', 'query')
  url.searchParams.set('generator', 'search')
  url.searchParams.set('gsrsearch', query)
  url.searchParams.set('gsrlimit', '1')
  url.searchParams.set('prop', 'extracts|info')
  url.searchParams.set('exintro', '1')
  url.searchParams.set('explaintext', '1')
  url.searchParams.set('inprop', 'url')
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')
  const response = await fetch(url, { headers: { 'User-Agent': 'Navi.training glossary research/1.0 (https://navi.training)' } })
  if (!response.ok) return null
  const body = await response.json() as any
  const page = Object.values(body.query?.pages || {})[0] as any
  return page?.extract ? { title: page.title, url: page.fullurl, excerpt: String(page.extract).slice(0, 2400) } : null
}

for (const concept of concepts) {
  const evidence = Object.fromEntries(await Promise.all((Object.entries(concept.queries) as [Locale, string][]).map(async ([locale, query]) => {
    const [articles, wikipedia] = await Promise.all([articleEvidence(locale, query), wikipediaEvidence(locale, query)])
    return [locale, { articles, wikipedia }]
  })))

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://payload.navi.training',
      'X-Title': 'Navi.training Yachting Encyclopedia',
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are the senior multilingual editor of “Navi.training Yachting Encyclopedia”. Produce accurate, practical yachting terminology in Russian, Ukrainian and English. Use the supplied Navi.training excerpts as the preferred house terminology and Wikipedia only as an attributed factual reference. Never invent a measurement, regulation or quotation. Each encyclopediaText must be 150–300 words in its own language, useful to a beginner but terminologically professional. Explicitly define units and quantities when the concept has them. Return strict JSON: {"domain":"navigation","translations":{"ru":{"term":"","slug":"","definition":"","encyclopediaText":"","usageNotes":"","seoTitle":"","seoDescription":"","imageAlt":""},"uk":{...},"en":{...}}}. Slugs must be lowercase URL-safe transliterations appropriate to each language route. SEO title <= 60 characters; description 120–160 characters. Do not include citations inside prose.`,
        },
        { role: 'user', content: JSON.stringify({ concept: concept.canonicalKey, evidence }) },
      ],
    }),
  })
  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 800)}`)
  const body = await response.json() as any
  const generated = JSON.parse(body.choices?.[0]?.message?.content || '{}')
  const translations = (['ru', 'uk', 'en'] as Locale[]).map((locale) => {
    const item = generated.translations?.[locale]
    if (!item?.term || !item?.slug || !item?.encyclopediaText) throw new Error(`${concept.canonicalKey}: incomplete ${locale} generation`)
    const words = String(item.encyclopediaText).trim().split(/\s+/).length
    if (words < 120 || words > 340) throw new Error(`${concept.canonicalKey}/${locale}: unexpected article length ${words}`)
    return { locale, ...item, status: publish ? 'approved' : 'proposed', provenance: 'agent', confidence: 0.82 }
  })

  const category = await payload.find({ collection: 'tags-new', locale: 'en', fallbackLocale: false, depth: 0, limit: 1, where: { slug: { equals: concept.category } } })
  const existing = await payload.find({ collection: 'glossary-terms', depth: 0, limit: 1, where: { canonicalKey: { equals: concept.canonicalKey } } })
  const sources = Object.values(evidence).flatMap((item: any) => [
    ...item.articles.map((article: any) => ({ name: `Navi.training: ${article.title}`, url: article.url, reusePolicy: 'ingest', retrievedAt: new Date().toISOString() })),
    ...(item.wikipedia ? [{ name: `Wikipedia: ${item.wikipedia.title}`, url: item.wikipedia.url, reusePolicy: 'attribution', license: 'CC BY-SA 4.0 / GFDL', retrievedAt: new Date().toISOString() }] : []),
  ])
  const data: any = {
    canonicalKey: concept.canonicalKey,
    domain: generated.domain || 'general',
    status: publish ? 'approved' : 'proposed',
    release: publish ? 'published' : 'mvp',
    categories: category.docs.map((doc) => doc.id),
    translations,
    sources,
    evidencePosts: [],
    editorNotes: `Generated by ${model} from matching Navi.training article context and attributed Wikipedia introductions. Requires periodic factual review.`,
  }
  if (existing.docs[0]) await payload.update({ collection: 'glossary-terms', id: existing.docs[0].id, data })
  else await payload.create({ collection: 'glossary-terms', data })
  console.log(`${publish ? 'Published' : 'Prepared'}: ${concept.canonicalKey}`)
}

process.exit(0)
