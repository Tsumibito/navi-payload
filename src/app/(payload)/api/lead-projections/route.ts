import config from '@payload-config'
import { createHmac, timingSafeEqual } from 'crypto'
import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

function authorized(request: Request): boolean {
  const configured = process.env.SEO_EXECUTOR_TOKEN
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!configured || !supplied || configured.length !== supplied.length) return false
  return timingSafeEqual(Buffer.from(configured), Buffer.from(supplied))
}

function leadRef(submissionId: string, secret: string): string {
  return `lead_${createHmac('sha256', secret).update(submissionId).digest('hex').slice(0, 24)}`
}

function missingFacts(lead: Record<string, unknown>): string[] {
  const requestKind = String(lead.requestKind || 'general')
  const missing: string[] = []
  if (requestKind === 'charter') {
    if (!lead.requestedStartDate || !lead.requestedEndDate) missing.push('dates')
    if (!lead.requestedLocation) missing.push('location')
    if (!lead.partySize) missing.push('party_size')
  }
  return missing
}

function project(lead: Record<string, unknown>, secret: string): Record<string, unknown> {
  const context = lead.requestContext && typeof lead.requestContext === 'object'
    ? lead.requestContext as Record<string, unknown>
    : {}
  return {
    leadRef: leadRef(String(lead.submissionId), secret),
    lifecycleStage: lead.lifecycleStage || 'inquiry',
    requestKind: lead.requestKind || 'general',
    qualificationStatus: lead.qualificationStatus || 'unknown',
    sourceChannel: lead.sourceChannel || 'unknown',
    locale: String(lead.locale || '').slice(0, 8),
    service: String(lead.service || '').slice(0, 160),
    requestedStartDate: lead.requestedStartDate || null,
    requestedEndDate: lead.requestedEndDate || null,
    requestedLocation: String(lead.requestedLocation || '').slice(0, 240) || null,
    partySize: typeof lead.partySize === 'number' ? lead.partySize : null,
    yachtReference: String(lead.yachtReference || '').slice(0, 240) || null,
    bookingAction: String(context.booking_action || '').slice(0, 32) || null,
    charterFormat: String(context.charter_format || '').slice(0, 32) || null,
    hasSkipperQualification: Boolean(String(context.skipper_qualification || '').trim()),
    missingFacts: missingFacts(lead),
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const secret = process.env.SEO_EXECUTOR_TOKEN!
  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 100)
  const updatedAfter = url.searchParams.get('updatedAfter')
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'leads',
    depth: 0,
    limit,
    sort: 'updatedAt',
    overrideAccess: true,
    ...(updatedAfter ? { where: { updatedAt: { greater_than: updatedAfter } } } : {}),
  })
  return NextResponse.json({
    count: result.docs.length,
    items: result.docs.map((lead) => project(lead as unknown as Record<string, unknown>, secret)),
    hasMore: result.hasNextPage,
  })
}
