/**
 * Модуль подсчета внутренних ссылок
 * 
 * Считает количество ссылок с данным анкором во всех Lexical полях указанных коллекций
 */

import type { Payload } from 'payload';
import { findLinksInLexical, type LinkMatch } from '../utils/lexicalLinkAnalysis';
import { getAllCollections, type CollectionToAnalyze } from '../config/linkAnalysisConfig';

export type LinkCountResult = {
  /** Анкор для поиска */
  anchor: string;
  /** Общее количество найденных ссылок */
  totalLinks: number;
  /** Детализация по коллекциям */
  byCollection: {
    collection: string;
    count: number;
    /** Список документов где найдены ссылки */
    documents?: Array<{
      id: string | number;
      title?: string;
      count: number;
    }>;
  }[];
};

type CountLinksOptions = {
  /** Payload instance */
  payload: Payload;
  /** Анкор для поиска */
  anchor: string;
  /** ID текущего документа (исключаем из поиска) */
  currentDocId?: string | number;
  /** Slug текущей коллекции */
  currentCollection?: string;
  /** Slug документа для проверки (ссылка должна содержать этот slug) */
  targetSlug?: string;
  /** Локаль для поиска */
  locale?: string;
  /** Возвращать ли детализацию по документам */
  includeDocuments?: boolean;
};

/**
 * Подсчитывает количество ссылок с данным анкором
 * 
 * @param options - опции для подсчета
 * @returns результат подсчета с детализацией
 */
export async function countInternalLinks(
  options: CountLinksOptions
): Promise<LinkCountResult> {
  const {
    payload,
    anchor,
    currentDocId,
    currentCollection,
    targetSlug,
    locale = 'none',
    includeDocuments = false,
  } = options;

  const normalizedAnchor = anchor.toLowerCase().trim();
  const normalizedSlug = targetSlug ? targetSlug.toLowerCase().trim() : null;
  const collections = getAllCollections();
  
  console.log('[linkCounter] Searching for anchor:', normalizedAnchor, 'with targetSlug:', normalizedSlug);

  let totalLinks = 0;
  const byCollection: LinkCountResult['byCollection'] = [];

  for (const collection of collections) {
    try {
      // Получаем документы коллекции
      const { docs } = await payload.find({
        collection: collection.slug as any,
        limit: 1000,
        locale: locale as any,
        depth: 0,
        where: currentDocId && currentCollection === collection.slug
          ? {
              and: [
                {
                  id: {
                    not_equals: currentDocId,
                  },
                },
              ],
            }
          : undefined,
      });

      console.log(`[linkCounter] Processing ${collection.slug}: ${docs.length} docs`);

      let collectionLinkCount = 0;
      const documents: LinkCountResult['byCollection'][0]['documents'] = [];

      for (const doc of docs) {
        let docLinkCount = 0;

        // Проверяем каждое Lexical поле
        for (const fieldName of collection.fields) {
          const fieldValue = (doc as any)[fieldName];

          if (!fieldValue) continue;

          // Находим ссылки в поле
          const links = findLinksInLexical(fieldValue);

          // Считаем совпадения по анкору И slug (если указан)
          const matchCount = links.filter(link => {
            const anchorMatches = link.anchorText.toLowerCase().trim() === normalizedAnchor;
            
            // Если slug указан, проверяем что URL содержит slug
            if (normalizedSlug) {
              const urlMatches = link.url.toLowerCase().includes(normalizedSlug);
              
              if (anchorMatches) {
                console.log('[linkCounter] Found link - anchor:', link.anchorText, 'url:', link.url, 'matches slug?', urlMatches);
              }
              
              return anchorMatches && urlMatches;
            }
            
            return anchorMatches;
          }).length;

          docLinkCount += matchCount;
        }

        // Проверяем FAQ поля если есть
        if ((doc as any).faqs && Array.isArray((doc as any).faqs)) {
          for (const faq of (doc as any).faqs) {
            if (faq.answer) {
              const links = findLinksInLexical(faq.answer);
              const matchCount = links.filter(link => {
                const anchorMatches = link.anchorText.toLowerCase().trim() === normalizedAnchor;
                
                // Если slug указан, проверяем что URL содержит slug
                if (normalizedSlug) {
                  const urlMatches = link.url.toLowerCase().includes(normalizedSlug);
                  
                  if (anchorMatches) {
                    console.log('[linkCounter] Found link in FAQ - anchor:', link.anchorText, 'url:', link.url, 'matches slug?', urlMatches);
                  }
                  
                  return anchorMatches && urlMatches;
                }
                
                return anchorMatches;
              }).length;
              docLinkCount += matchCount;
            }
          }
        }

        if (docLinkCount > 0) {
          collectionLinkCount += docLinkCount;

          if (includeDocuments) {
            documents.push({
              id: (doc as any).id,
              title: (doc as any).name || (doc as any).title || `Document ${(doc as any).id}`,
              count: docLinkCount,
            });
          }
        }
      }

      if (collectionLinkCount > 0) {
        byCollection.push({
          collection: collection.slug,
          count: collectionLinkCount,
          documents: includeDocuments ? documents : undefined,
        });
        totalLinks += collectionLinkCount;
      }

    } catch (error) {
      console.error(`[linkCounter] Error processing ${collection.slug}:`, error);
    }
  }

  console.log(`[linkCounter] Total links for "${anchor}": ${totalLinks}`);

  return {
    anchor,
    totalLinks,
    byCollection,
  };
}
