import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { countInternalLinks } from '@/modules/linkCounter';
import { countPotentialLinks } from '@/modules/potentialLinkCounter';

type LinkStatsResult = {
  anchor: string;
  existingLinks: number;
  potentialLinks: number;
  /** Детализация по коллекциям (опционально) */
  details?: {
    internalLinks?: any;
    potentialLinks?: any;
  };
};

/**
 * POST /api/seo-stats/calculate-links
 * 
 * Body: {
 *   entity_type: string;
 *   entity_id: string;
 *   language: string; // 'ru' | 'uk' | 'en'
 *   anchors: string[]; // массив анкоров для проверки
 *   slug?: string; // для проверки внешних ссылок
 * }
 * 
 * Response: LinkStatsResult[]
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config });
    const body = await request.json();

    const { entity_type, entity_id, language, anchors, targetSlug, includeDetails } = body;

    if (!entity_type || !entity_id || !language || !Array.isArray(anchors)) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_type, entity_id, language, anchors' },
        { status: 400 }
      );
    }
    
    console.log('[calculate-links] targetSlug:', targetSlug);

    const results: LinkStatsResult[] = [];

    console.log('[calculate-links] Processing anchors:', anchors, 'includeDetails:', includeDetails);

    // Обрабатываем каждый анкор
    for (const anchor of anchors) {
      if (!anchor || typeof anchor !== 'string') {
        console.log('[calculate-links] Skipping invalid anchor:', anchor);
        continue;
      }

      // Очищаем анкор от лишних символов (если они есть)
      const cleanedAnchor = anchor
        .replace(/^\{+/g, '')
        .replace(/\}+$/g, '')
        .replace(/\\"/g, '"')
        .replace(/^["']+/g, '')
        .replace(/["']+$/g, '')
        .trim();

      console.log('[calculate-links] Processing anchor:', cleanedAnchor, '(original:', anchor, ')');

      // Используем модули для подсчета
      const [internalLinksResult, potentialLinksResult] = await Promise.all([
        countInternalLinks({
          payload,
          anchor: cleanedAnchor,
          currentDocId: entity_id,
          currentCollection: entity_type,
          targetSlug, // Передаем slug для проверки URL
          locale: language, // Используем переданный язык
          includeDocuments: includeDetails || false, // Детализация по запросу
        }),
        countPotentialLinks({
          payload,
          anchor: cleanedAnchor,
          currentDocId: entity_id,
          currentCollection: entity_type,
          locale: language, // Используем переданный язык
          includeDocuments: includeDetails || false,
        }),
      ]);

      console.log(`[calculate-links] Anchor "${cleanedAnchor}": existing=${internalLinksResult.totalLinks}, potential=${potentialLinksResult.totalPotential}`);

      results.push({
        anchor: cleanedAnchor,
        existingLinks: internalLinksResult.totalLinks,
        potentialLinks: potentialLinksResult.totalPotential,
        details: {
          internalLinks: internalLinksResult.byCollection,
          potentialLinks: potentialLinksResult.byCollection,
        },
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[calculate-links] Error:', error);
    return NextResponse.json({ error: 'Failed to calculate links' }, { status: 500 });
  }
}
