import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@payloadcms/db-postgres/drizzle';

import { authenticatePayloadRequest, unauthorizedResponse } from '@/utils/authenticatedPayload';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticatePayloadRequest(request);
    if (!auth) return unauthorizedResponse();
    const { payload } = auth;
    const { searchParams } = new URL(request.url);
    
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const locale = searchParams.get('locale') || 'uk'; // ВАЖНО: учитываем локаль!

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 });
    }

    console.log('[seo-stats GET] Loading:', { entityType, entityId, locale });

    const result = await payload.db.drizzle.execute(
      sql`SELECT * FROM navi."seo-stats" 
          WHERE entity_type = ${entityType} 
            AND entity_id = ${entityId} 
            AND locale = ${locale} 
          LIMIT 1`
    );

    if (result.rows && result.rows.length > 0) {
      console.log('[seo-stats GET] Found data for locale:', locale);
      return NextResponse.json(result.rows[0]);
    }

    console.log('[seo-stats GET] No data for locale:', locale);
    return NextResponse.json(null);
  } catch (error) {
    console.error('[seo-stats GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticatePayloadRequest(request);
    if (!auth) return unauthorizedResponse();
    const { payload } = auth;
    const body = await request.json();
    
    const { entity_type, entity_id, locale, focus_keyphrase, stats, link_keywords, calculated_at } = body;

    console.log('[seo-stats POST] Request:', { 
      entity_type, 
      entity_id,
      locale, // ВАЖНО: логируем локаль
      has_focus_keyphrase: !!focus_keyphrase,
      has_stats: !!stats,
      has_link_keywords: !!link_keywords,
      link_keywords_sample: link_keywords ? JSON.stringify(link_keywords).substring(0, 200) : null
    });

    if (!entity_type || !entity_id) {
      return NextResponse.json({ error: 'Missing entity_type or entity_id' }, { status: 400 });
    }

    const localeVal = locale || 'uk'; // По умолчанию uk
    const focusKeyphraseVal = focus_keyphrase ?? null;
    const statsJson = stats ? JSON.stringify(stats) : null;
    const linkKeywordsJson = link_keywords ? JSON.stringify(link_keywords) : null;
    const calculatedAtVal = calculated_at ?? null;

    // One atomic upsert avoids races and always supplies the table's required
    // focus_keyphrase and stats fields for a locale that does not exist yet.
    const upsertResult = await payload.db.drizzle.execute(
      sql`INSERT INTO navi."seo-stats" AS existing (
            entity_type, entity_id, locale, focus_keyphrase, stats, link_keywords, calculated_at, created_at, updated_at
          )
          VALUES (
            ${entity_type}, ${entity_id}, ${localeVal}, COALESCE(${focusKeyphraseVal}, ''),
            COALESCE(${statsJson}::jsonb, '{}'::jsonb), ${linkKeywordsJson}::jsonb, ${calculatedAtVal}::timestamp,
            NOW(), NOW()
          )
          ON CONFLICT (entity_type, entity_id, locale) DO UPDATE SET
            focus_keyphrase = COALESCE(${focusKeyphraseVal}, existing.focus_keyphrase),
            stats = COALESCE(${statsJson}::jsonb, existing.stats),
            link_keywords = COALESCE(${linkKeywordsJson}::jsonb, existing.link_keywords),
            calculated_at = COALESCE(${calculatedAtVal}::timestamp, existing.calculated_at),
            updated_at = NOW()
          RETURNING *`
    );

    console.log('[seo-stats POST] Saved successfully for locale:', localeVal);
    return NextResponse.json(upsertResult.rows[0]);
  } catch (error) {
    console.error('[seo-stats POST] Error:', error);
    console.error('[seo-stats POST] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: 'Failed to save stats' }, { status: 500 });
  }
}
