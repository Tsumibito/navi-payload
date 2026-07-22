import { getPayload } from 'payload'

import config from '../src/payload.config'
import type { ContentLocale } from '../src/config/contentLocales'

const postId = Number(process.argv[2])
if (!Number.isInteger(postId) || postId < 1) throw new Error('Usage: tsx scripts/repair-post-link-plans.ts <postId>')
const markReady = process.argv.includes('--ready')

const payload = await getPayload({ config })
const locales: ContentLocale[] = ['ru', 'uk', 'en']

try {
  const pool = (payload.db as any)?.pool
  if (!pool?.query) throw new Error('Payload Postgres pool is unavailable')

  for (const locale of locales) {
    const [outboundResult, inboundResult] = await Promise.all([
      pool.query(
        `SELECT source_node_path AS "sourceNodePath", source_content_hash AS "sourceContentHash",
                target_post_id AS "targetId", target_post_id AS "targetPostId", target_url AS url,
                anchor_text AS anchor, reason, relevance_score AS "relevanceScore"
           FROM navi.internal_links
          WHERE source_post_id = $1 AND source_locale = $2 AND state = 'suggested'
          ORDER BY relevance_score DESC NULLS LAST`,
        [postId, locale],
      ),
      pool.query(
        `SELECT edge.source_post_id AS "sourcePostId", edge.source_locale AS locale,
                edge.source_node_path AS "sourceNodePath", edge.source_content_hash AS "sourceContentHash",
                edge.target_post_id AS "targetPostId", edge.target_url AS url,
                edge.anchor_text AS anchor, edge.reason, edge.relevance_score AS "relevanceScore",
                source_locale.name AS "sourceTitle"
           FROM navi.internal_links edge
           LEFT JOIN navi.posts_new_locales source_locale
             ON source_locale._parent_id = edge.source_post_id AND source_locale._locale::text = edge.source_locale
          WHERE edge.target_post_id = $1 AND edge.source_locale = $2 AND edge.state = 'suggested'
          ORDER BY edge.relevance_score DESC NULLS LAST`,
        [postId, locale],
      ),
    ])
    const post = await payload.findByID({ collection: 'posts-new', id: postId, locale, fallbackLocale: false, depth: 0 }) as any
    await payload.update({
      collection: 'posts-new', id: postId, locale, context: { skipLocalizationWorkflow: true },
      data: {
        ...(markReady ? { publicationStatus: 'ready' } : {}),
        localizationWorkflow: {
          ...(post.localizationWorkflow || {}),
          linkPlan: outboundResult.rows,
          inboundLinkPlan: inboundResult.rows,
          state: 'review',
          currentStage: 'Ready for publication review',
          lastError: null,
        },
      },
    })
    payload.logger.info({ postId, locale, outbound: outboundResult.rows.length, inbound: inboundResult.rows.length }, 'Restored localized link plans')
  }
} finally {
  const closing = (payload.db as any)?.pool?.end?.()
  if (closing) await Promise.race([closing, new Promise((resolve) => setTimeout(resolve, 2_000))])
}

process.exit(0)
