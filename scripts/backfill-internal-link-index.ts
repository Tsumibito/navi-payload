import { getPayload } from 'payload'

import config from '../src/payload.config'
import type { ContentLocale } from '../src/config/contentLocales'
import { backfillLinkIndex } from '../src/utils/internalLinkRag'

const payload = await getPayload({ config })
let cursor = Math.max(0, Number(process.env.LINK_INDEX_CURSOR || 0))
const limit = Math.min(10, Math.max(1, Number(process.env.LINK_INDEX_LIMIT || 5)))
const requestedLocales = (process.env.LINK_INDEX_LOCALES || 'ru,uk,en').split(',').map((value) => value.trim())
const locales = requestedLocales.filter((value): value is ContentLocale => ['ru', 'uk', 'en'].includes(value))
let totals = { processed: 0, passages: 0, embedded: 0, links: 0, failed: 0 }

try {
  while (true) {
    const batch = await backfillLinkIndex(payload, { cursor, limit, locales, continueOnError: true })
    totals = {
      processed: totals.processed + batch.processed,
      passages: totals.passages + batch.passages,
      embedded: totals.embedded + batch.embedded,
      links: totals.links + batch.links,
      failed: totals.failed + batch.failed,
    }
    payload.logger.info({ cursor, ...batch, totals }, 'Internal-link index backfill batch completed')
    if (batch.done || batch.nextCursor == null) break
    cursor = batch.nextCursor
  }
  payload.logger.info(totals, 'Internal-link index backfill completed')
} finally {
  const closing = (payload.db as any)?.pool?.end?.()
  if (closing) await Promise.race([closing, new Promise((resolve) => setTimeout(resolve, 2_000))])
}

// Payload keeps a few background handles alive after initialization. This is
// a finite maintenance command, so terminate cleanly once every batch and the
// database pool have completed.
process.exit(0)
