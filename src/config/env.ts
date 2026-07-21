const required = (name: string): string => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const url = (name: string, fallback?: string): string => {
  const value = process.env[name]?.trim() || fallback
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  try {
    return new URL(value).toString().replace(/\/$/, '')
  } catch {
    throw new Error(`Invalid URL in environment variable: ${name}`)
  }
}

const positiveInteger = (name: string, fallback: number): number => {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const env = {
  payloadSecret: required('PAYLOAD_SECRET'),
  ssgApiKey: required('PAYLOAD_SSG_API_KEY'),
  databaseUri: required('DATABASE_URI'),
  databaseSchema: process.env.PAYLOAD_DB_SCHEMA?.trim() || 'navi',
  serverUrl: url('PAYLOAD_PUBLIC_SERVER_URL', 'http://localhost:3000'),
  r2: {
    accessKeyId: required('CLOUDFLARE_R2_ACCESS_KEY_ID'),
    secretAccessKey: required('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
    bucket: required('CLOUDFLARE_R2_BUCKET_NAME'),
    endpoint: url('CLOUDFLARE_R2_ENDPOINT'),
    publicUrl: url('CLOUDFLARE_R2_PUBLIC_URL'),
  },
  databasePool: {
    min: positiveInteger('DATABASE_POOL_MIN', 1),
    max: positiveInteger('DATABASE_POOL_MAX', 10),
    idleTimeoutMillis: positiveInteger('DATABASE_POOL_IDLE_TIMEOUT_MS', 60_000),
    connectionTimeoutMillis: positiveInteger('DATABASE_POOL_CONNECTION_TIMEOUT_MS', 10_000),
  },
} as const
