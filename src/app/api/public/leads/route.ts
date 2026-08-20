import config from '@payload-config'
import { getPayload } from 'payload'
import { sendLeadEmails, sendSubscriberEmails, syncBrevoSubscriber } from '@/lib/brevo'
import { lookupGeoIp } from '@/lib/geoip'

const allowedOrigins = [
  /^https:\/\/(?:www\.)?navi\.training$/,
  /^https:\/\/[a-z0-9-]+\.navi-training\.pages\.dev$/,
  /^http:\/\/localhost(?::\d+)?$/,
]

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.some((pattern) => pattern.test(origin)) ? origin : 'https://navi.training'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function requestIp(request: Request) {
  return String(
    request.headers.get('cf-connecting-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0]
      || '',
  ).trim().slice(0, 80)
}

const contextKeys = new Set([
  'yacht_id', 'yacht_name', 'region', 'base', 'offer_start', 'offer_end', 'party_context',
  'final_price', 'currency', 'booking_action', 'adults', 'children', 'charter_format',
  'skipper_qualification',
])

function requestKind(service: string): 'general' | 'training' | 'charter' | 'delivery' | 'expertise' {
  if (service.startsWith('yacht-charter')) return 'charter'
  if (service === 'yacht-delivery') return 'delivery'
  if (service === 'yacht-expertise') return 'expertise'
  if (/training|course|school|inshore|offshore/.test(service)) return 'training'
  return 'general'
}

function sourceChannel(utm: string): 'organic' | 'direct' | 'referral' | 'paid' | 'unknown' {
  const params = new URLSearchParams(utm)
  const medium = String(params.get('utm_medium') || '').toLowerCase()
  const source = String(params.get('utm_source') || '').toLowerCase()
  if (['cpc', 'ppc', 'paid', 'paid_search'].includes(medium)) return 'paid'
  if (medium === 'organic' || ['google', 'bing', 'duckduckgo', 'yandex'].includes(source)) return 'organic'
  if (source || medium === 'referral') return 'referral'
  return utm ? 'unknown' : 'direct'
}

function sanitizedContext(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => contextKeys.has(key))
    .map(([key, child]) => [key, String(child || '').trim().slice(0, 500)]))
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get('origin')) })
}

export async function POST(request: Request) {
  const headers = { ...cors(request.headers.get('origin')), 'Content-Type': 'application/json' }
  const origin = request.headers.get('origin')
  if (!origin || !allowedOrigins.some((pattern) => pattern.test(origin))) {
    return Response.json({ ok: false, error: 'origin_not_allowed' }, { status: 403, headers })
  }

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400, headers })
  }

  // A filled hidden field means a bot. Return success without storing it.
  if (String(input.company || '').trim()) return Response.json({ ok: true }, { headers })

  const email = String(input.email || '').trim().toLowerCase()
  const suppliedSubmissionId = String(input.submissionId || '').trim().slice(0, 100)
  // Keep old browser tabs and direct integrations working during rollout.
  // Edge-queued submissions always provide their own stable idempotency key.
  const submissionId = /^[a-zA-Z0-9_-]{16,100}$/.test(suppliedSubmissionId)
    ? suppliedSubmissionId
    : `legacy-${crypto.randomUUID()}`
  const kind = input.kind === 'newsletter' ? 'newsletter' : ['contact', 'service'].includes(String(input.kind)) ? 'contact' : null
  if (!kind || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.consent !== true) {
    return Response.json({ ok: false, error: 'invalid_fields' }, { status: 422, headers })
  }

  const clean = (value: unknown, max: number) => String(value || '').trim().slice(0, max)
  const service = clean(input.service, 160)
  const utm = clean(input.utm, 1000)
  const context = sanitizedContext(input.context)
  const adults = Math.max(0, Math.min(24, Number.parseInt(context.adults || '0', 10) || 0))
  const children = Math.max(0, Math.min(24, Number.parseInt(context.children || '0', 10) || 0))
  const partySize = adults + children || null
  const ip = requestIp(request)
  const payload = await getPayload({ config })
  // The generated Payload types are updated during the deployment build. Keep
  // this route deployable in the same commit that introduces the collection.
  const database = payload as unknown as {
    find: (args: Record<string, unknown>) => Promise<{ totalDocs: number }>
    create: (args: Record<string, unknown>) => Promise<unknown>
  }

  if (kind === 'newsletter') {
    const existing = await database.find({
      collection: 'subscribers',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.totalDocs) {
      try {
        await syncBrevoSubscriber({
          email,
          firstName: clean(input.firstName, 120),
          lastName: clean(input.lastName, 120),
        })
      } catch (error) {
        console.error('Existing subscriber sync failed', error instanceof Error ? error.message : 'unknown error')
      }
      return Response.json({ ok: true, existing: true }, { headers })
    }
    await database.create({
      collection: 'subscribers',
      overrideAccess: true,
      data: {
        submissionId,
        email,
        status: 'subscribed',
        firstName: clean(input.firstName, 120),
        lastName: clean(input.lastName, 120),
        locale: clean(input.locale, 8),
        sourceUrl: clean(input.sourceUrl, 500),
        utm: clean(input.utm, 1000),
        ip,
        userAgent: clean(request.headers.get('user-agent'), 500),
        consentAt: new Date().toISOString(),
      },
    })
    try {
      await sendSubscriberEmails({
        email,
        firstName: clean(input.firstName, 120),
        lastName: clean(input.lastName, 120),
        locale: clean(input.locale, 8),
        sourceUrl: clean(input.sourceUrl, 500),
      })
    } catch (error) {
      console.error('Subscriber email delivery failed', error instanceof Error ? error.message : 'unknown error')
    }
    return Response.json({ ok: true }, { status: 201, headers })
  }

  const geoPromise = lookupGeoIp(ip)
  const existingLead = await database.find({
    collection: 'leads',
    where: { submissionId: { equals: submissionId } },
    limit: 1,
    overrideAccess: true,
  })
  if (existingLead.totalDocs) return Response.json({ ok: true, existing: true }, { headers })
  await database.create({
    collection: 'leads',
    overrideAccess: true,
    data: {
      submissionId,
      email,
      kind,
      status: 'new',
      firstName: clean(input.firstName, 120),
      lastName: clean(input.lastName, 120),
      phone: clean(input.phone, 80),
      message: clean(input.message, 3000),
      service,
      requestKind: requestKind(service),
      lifecycleStage: 'inquiry',
      qualificationStatus: 'unknown',
      sourceChannel: sourceChannel(utm),
      requestedStartDate: context.offer_start || null,
      requestedEndDate: context.offer_end || null,
      requestedLocation: clean(context.region || context.base, 240),
      partySize,
      yachtReference: clean(context.yacht_id, 240),
      requestContext: context,
      locale: clean(input.locale, 8),
      sourceUrl: clean(input.sourceUrl, 500),
      utm,
      ip,
      userAgent: clean(request.headers.get('user-agent'), 500),
      consentAt: new Date().toISOString(),
    },
  })

  try {
    const geo = await geoPromise
    await sendLeadEmails({
      email,
      firstName: clean(input.firstName, 120),
      lastName: clean(input.lastName, 120),
      phone: clean(input.phone, 80),
      message: clean(input.message, 3000),
      service: clean(input.service, 160),
      locale: clean(input.locale, 8),
      sourceUrl: clean(input.sourceUrl, 500),
      ip,
      geo,
    })
  } catch (error) {
    console.error('Lead email delivery failed', error instanceof Error ? error.message : 'unknown error')
  }

  return Response.json({ ok: true }, { status: 201, headers })
}
