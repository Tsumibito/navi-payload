import config from '@payload-config'
import { createHash, timingSafeEqual } from 'crypto'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

const ALLOWED_COLLECTIONS = new Set(['posts-new', 'pages'])
const ALLOWED_LOCALES = new Set(['en', 'ru', 'uk'])
const ALLOWED_FIELDS: Record<string, Set<string>> = {
  'posts-new': new Set(['seo.title', 'seo.meta_description', 'seo.focus_keyphrase', 'faqs']),
  pages: new Set(['seo.title', 'seo.meta_description', 'seo.focus_keyphrase']),
}
const DENIED_SEGMENTS = new Set([
  'slug', 'publicSlug', 'canonical', 'hreflang', 'redirect', 'robots', 'no_index',
  'publicationStatus', '_status', 'id', 'createdAt', 'updatedAt',
])

type PatchOperation = { field: string; value: unknown }
type ExecutorRequest = {
  collection?: string
  documentId?: string | number
  locale?: string
  expectedHash?: string
  idempotencyKey?: string
  operations?: PatchOperation[]
}

function authorized(request: Request): boolean {
  const configured = process.env.SEO_EXECUTOR_TOKEN
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!configured || !supplied || configured.length !== supplied.length) return false
  return timingSafeEqual(Buffer.from(configured), Buffer.from(supplied))
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function digest(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex')
}

function readField(document: Record<string, unknown>, field: string): unknown {
  return field.split('.').reduce<unknown>((value, segment) => (
    value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined
  ), document)
}

function applyField(target: Record<string, unknown>, field: string, value: unknown): void {
  const parts = field.split('.')
  let cursor = target
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part]
    cursor[part] = existing && typeof existing === 'object' ? { ...(existing as object) } : {}
    cursor = cursor[part] as Record<string, unknown>
  }
  cursor[parts.at(-1)!] = value
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as ExecutorRequest | null
  if (!body?.collection || !ALLOWED_COLLECTIONS.has(body.collection)) {
    return NextResponse.json({ error: 'Collection is not allowed' }, { status: 422 })
  }
  if (!body.documentId || !body.locale || !ALLOWED_LOCALES.has(body.locale)) {
    return NextResponse.json({ error: 'Document and locale are required' }, { status: 422 })
  }
  if (!body.expectedHash?.match(/^[a-f0-9]{64}$/) || !body.idempotencyKey) {
    return NextResponse.json({ error: 'Version lock and idempotency key are required' }, { status: 422 })
  }
  if (!Array.isArray(body.operations) || body.operations.length < 1 || body.operations.length > 5) {
    return NextResponse.json({ error: 'One to five operations are required' }, { status: 422 })
  }
  for (const operation of body.operations) {
    const segments = operation.field.split('.')
    if (!ALLOWED_FIELDS[body.collection].has(operation.field)
      || segments.some((part) => DENIED_SEGMENTS.has(part))) {
      return NextResponse.json({ error: `Field is prohibited: ${operation.field}` }, { status: 422 })
    }
  }

  const payload = await getPayload({ config })
  const collection = body.collection as 'posts-new' | 'pages'
  const current = await payload.findByID({
    collection, id: body.documentId, locale: body.locale as 'en' | 'ru' | 'uk',
    fallbackLocale: false, depth: 0,
  }) as unknown as Record<string, unknown>
  const before = Object.fromEntries(body.operations.map(({ field }) => [field, readField(current, field)]))
  const desired = Object.fromEntries(body.operations.map(({ field, value }) => [field, value]))
  if (stable(before) === stable(desired)) {
    const contentHash = digest(before)
    return NextResponse.json({
      applied: false, idempotent: true, idempotencyKey: body.idempotencyKey,
      before, after: desired, priorHash: contentHash, appliedHash: contentHash,
    })
  }
  const currentHash = digest(before)
  if (currentHash !== body.expectedHash) {
    return NextResponse.json({ error: 'Content changed after approval', currentHash }, { status: 409 })
  }
  const data: Record<string, unknown> = {}
  for (const operation of body.operations) applyField(data, operation.field, operation.value)
  await payload.update({
    collection, id: body.documentId, locale: body.locale as 'en' | 'ru' | 'uk',
    fallbackLocale: false, data, context: { skipLocalizationWorkflow: true },
  })
  return NextResponse.json({
    applied: true,
    idempotent: false,
    idempotencyKey: body.idempotencyKey,
    before,
    after: desired,
    priorHash: currentHash,
    appliedHash: digest(desired),
  })
}
