import { NextResponse } from 'next/server'

import type { ContentLocale } from '@/config/contentLocales'
import { backfillLinkIndex } from '@/utils/internalLinkRag'
import { authenticatePayloadRequest, unauthorizedResponse } from '@/utils/authenticatedPayload'

const ALLOWED_LOCALES = new Set<ContentLocale>(['ru', 'uk', 'en'])

export async function GET(request: Request) {
  const auth = await authenticatePayloadRequest(request)
  if (!auth) return unauthorizedResponse()
  const pool = (auth.payload as any).db?.pool
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM navi.link_passages) AS passages,
      (SELECT count(DISTINCT (post_id, locale))::int FROM navi.link_passages) AS indexed_post_locales,
      (SELECT count(*)::int FROM navi.internal_links WHERE state IN ('existing', 'applied')) AS existing_links,
      (SELECT count(*)::int FROM navi.internal_links WHERE state = 'suggested') AS suggestions
  `)
  return NextResponse.json(result.rows?.[0] || {})
}

export async function POST(request: Request) {
  const auth = await authenticatePayloadRequest(request)
  if (!auth) return unauthorizedResponse()
  try {
    const body = await request.json().catch(() => ({})) as { cursor?: number; limit?: number; locales?: string[] }
    const locales = (body.locales || ['ru', 'uk', 'en'])
      .filter((locale): locale is ContentLocale => ALLOWED_LOCALES.has(locale as ContentLocale))
    const result = await backfillLinkIndex(auth.payload, { cursor: body.cursor, limit: body.limit, locales })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal-link indexing failed' }, { status: 500 })
  }
}
