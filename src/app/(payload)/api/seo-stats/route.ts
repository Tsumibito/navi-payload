import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config });
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
    const payload = await getPayload({ config });
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

    // Try update first - ВАЖНО: учитываем locale в WHERE!
    const updateResult = await payload.db.drizzle.execute(
      sql`UPDATE navi."seo-stats" 
          SET 
            focus_keyphrase = COALESCE(${focusKeyphraseVal}, focus_keyphrase),
            stats = COALESCE(${statsJson}::jsonb, stats),
            link_keywords = COALESCE(${linkKeywordsJson}::jsonb, link_keywords),
            calculated_at = COALESCE(${calculatedAtVal}::timestamp, calculated_at),
            updated_at = NOW()
          WHERE entity_type = ${entity_type} 
            AND entity_id = ${entity_id}
            AND locale = ${localeVal}
          RETURNING *`
    );

    if (updateResult.rows && updateResult.rows.length > 0) {
      console.log('[seo-stats POST] Updated successfully for locale:', localeVal);
      return NextResponse.json(updateResult.rows[0]);
    }

    // If no rows updated, insert new record - ВАЖНО: добавляем locale!
    console.log('[seo-stats POST] No existing record for locale:', localeVal, '- inserting new');
    const insertResult = await payload.db.drizzle.execute(
      sql`INSERT INTO navi."seo-stats" (
            entity_type, entity_id, locale, focus_keyphrase, stats, link_keywords, calculated_at, created_at, updated_at
          )
          VALUES (
            ${entity_type}, ${entity_id}, ${localeVal}, ${focusKeyphraseVal}, 
            ${statsJson}::jsonb, ${linkKeywordsJson}::jsonb, ${calculatedAtVal}::timestamp,
            NOW(), NOW()
          )
          RETURNING *`
    );

    console.log('[seo-stats POST] Inserted successfully for locale:', localeVal);
    return NextResponse.json(insertResult.rows[0]);
  } catch (error) {
    console.error('[seo-stats POST] Error:', error);
    console.error('[seo-stats POST] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: 'Failed to save stats' }, { status: 500 });
  }
}
