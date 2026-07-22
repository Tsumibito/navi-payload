import { getPayload } from 'payload'

import config from '../src/payload.config'
import type { ContentLocale } from '../src/config/contentLocales'
import { localizePostTask } from '../src/jobs/localizePost'

const postId = Number(process.argv[2])
if (!Number.isInteger(postId) || postId < 1) throw new Error('Usage: tsx scripts/run-post-taxonomy.ts <postId>')

const payload = await getPayload({ config })
const locales: ContentLocale[] = ['ru', 'uk', 'en']

try {
  const handler = localizePostTask.handler as any
  for (const locale of locales) {
    payload.logger.info({ postId, locale }, 'Generating localized taxonomy and internal links')
    await handler({
      input: {
        postId,
        sourceLocale: locale,
        targetLocales: [locale],
        changedFields: ['content', 'tags'],
        stages: ['taxonomy-links'],
        fieldScope: 'all',
      },
      req: { payload },
    })
  }
  payload.logger.info({ postId, locales }, 'Localized taxonomy and internal links completed')
} finally {
  const closing = (payload.db as any)?.pool?.end?.()
  if (closing) await Promise.race([closing, new Promise((resolve) => setTimeout(resolve, 2_000))])
}

process.exit(0)
