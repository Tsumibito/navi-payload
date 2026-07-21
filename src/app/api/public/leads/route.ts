import config from '@payload-config'
import { getPayload } from 'payload'

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
  const kind = input.kind === 'contact' ? 'contact' : input.kind === 'newsletter' ? 'newsletter' : null
  if (!kind || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || input.consent !== true) {
    return Response.json({ ok: false, error: 'invalid_fields' }, { status: 422, headers })
  }

  const clean = (value: unknown, max: number) => String(value || '').trim().slice(0, max)
  const payload = await getPayload({ config })
  // The generated Payload types are updated during the deployment build. Keep
  // this route deployable in the same commit that introduces the collection.
  const leads = payload as unknown as {
    find: (args: Record<string, unknown>) => Promise<{ totalDocs: number }>
    create: (args: Record<string, unknown>) => Promise<unknown>
  }

  if (kind === 'newsletter') {
    const existing = await leads.find({
      collection: 'leads',
      where: { and: [{ email: { equals: email } }, { kind: { equals: 'newsletter' } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.totalDocs) return Response.json({ ok: true, existing: true }, { headers })
  }

  await leads.create({
    collection: 'leads',
    overrideAccess: true,
    data: {
      email,
      kind,
      status: kind === 'newsletter' ? 'subscribed' : 'new',
      firstName: clean(input.firstName, 120),
      lastName: clean(input.lastName, 120),
      phone: clean(input.phone, 80),
      message: clean(input.message, 3000),
      locale: clean(input.locale, 8),
      sourceUrl: clean(input.sourceUrl, 500),
      utm: clean(input.utm, 1000),
      ip: clean(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for'), 80),
      userAgent: clean(request.headers.get('user-agent'), 500),
      consentAt: new Date().toISOString(),
    },
  })

  return Response.json({ ok: true }, { status: 201, headers })
}
