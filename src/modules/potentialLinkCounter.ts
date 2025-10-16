/**
 * Модуль подсчета потенциальных ссылок
 * 
 * Считает количество упоминаний анкора (не занятых ссылками) во всех Lexical полях указанных коллекций
 */

import type { Payload } from 'payload';
import { 
  extractTextFromLexical,
  findAnchorMentions,
  findLinksInLexical,
} from '../utils/lexicalLinkAnalysis';
import { getAllCollections } from '../config/linkAnalysisConfig';

export type PotentialLinkResult = {
  /** Анкор для поиска */
  anchor: string;
  /** Общее количество потенциальных мест */
  totalPotential: number;
  /** Детализация по коллекциям */
  byCollection: {
    collection: string;
    count: number;
    /** Список документов где найдены потенциальные места */
    documents?: Array<{
      id: string | number;
      title?: string;
      count: number;
    }>;
  }[];
};

type CountPotentialOptions = {
  /** Payload instance */
  payload: Payload;
  /** Анкор для поиска */
  anchor: string;
  /** ID текущего документа (исключаем из поиска) */
  currentDocId?: string | number;
  /** Slug текущей коллекции */
  currentCollection?: string;
  /** Локаль для поиска */
  locale?: string;
  /** Возвращать ли детализацию по документам */
  includeDocuments?: boolean;
};

/**
 * Подсчитывает потенциальные места для ссылок в контенте
 * 
 * Находит упоминания анкора в тексте, которые НЕ являются ссылками
 * 
 * @param content - Lexical контент
 * @param anchor - анкор для поиска
 * @returns количество потенциальных мест
 */
function countPotentialInContent(content: unknown, anchor: string): number {
  if (!content || typeof content !== 'object') return 0;

  // Извлекаем весь текст из Lexical
  const text = extractTextFromLexical(content);
  if (!text) return 0;

  // Находим все упоминания анкора
  const mentions = findAnchorMentions(text, anchor);
  const totalMentions = mentions.length;

  if (totalMentions === 0) return 0;

  // Находим существующие ссылки с этим анкором
  const links = findLinksInLexical(content);
  const linksWithAnchor = links.filter(
    link => link.anchorText.toLowerCase().trim() === anchor.toLowerCase().trim()
  ).length;

  // Потенциальные = Всего упоминаний - Уже есть ссылок
  const potential = Math.max(0, totalMentions - linksWithAnchor);

  return potential;
}

/**
 * Подсчитывает количество потенциальных мест для ссылок с данным анкором
 * 
 * @param options - опции для подсчета
 * @returns результат подсчета с детализацией
 */
export async function countPotentialLinks(
  options: CountPotentialOptions
): Promise<PotentialLinkResult> {
  const {
    payload,
    anchor,
    currentDocId,
    currentCollection,
    locale = 'none',
    includeDocuments = false,
  } = options;

  const collections = getAllCollections();

  let totalPotential = 0;
  const byCollection: PotentialLinkResult['byCollection'] = [];

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

      console.log(`[potentialLinkCounter] Processing ${collection.slug}: ${docs.length} docs`);

      let collectionPotentialCount = 0;
      const documents: PotentialLinkResult['byCollection'][0]['documents'] = [];

      for (const doc of docs) {
        let docPotentialCount = 0;

        // Проверяем каждое Lexical поле
        for (const fieldName of collection.fields) {
          const fieldValue = (doc as any)[fieldName];

          if (!fieldValue) continue;

          // Считаем потенциальные места
          const potentialCount = countPotentialInContent(fieldValue, anchor);
          docPotentialCount += potentialCount;
        }

        // Проверяем FAQ поля если есть
        if ((doc as any).faqs && Array.isArray((doc as any).faqs)) {
          for (const faq of (doc as any).faqs) {
            if (faq.answer) {
              const potentialCount = countPotentialInContent(faq.answer, anchor);
              docPotentialCount += potentialCount;
            }
          }
        }

        if (docPotentialCount > 0) {
          collectionPotentialCount += docPotentialCount;

          if (includeDocuments) {
            documents.push({
              id: (doc as any).id,
              title: (doc as any).name || (doc as any).title || `Document ${(doc as any).id}`,
              count: docPotentialCount,
            });
          }
        }
      }

      if (collectionPotentialCount > 0) {
        byCollection.push({
          collection: collection.slug,
          count: collectionPotentialCount,
          documents: includeDocuments ? documents : undefined,
        });
        totalPotential += collectionPotentialCount;
      }

    } catch (error) {
      console.error(`[potentialLinkCounter] Error processing ${collection.slug}:`, error);
    }
  }

  console.log(`[potentialLinkCounter] Total potential for "${anchor}": ${totalPotential}`);

  return {
    anchor,
    totalPotential,
    byCollection,
  };
}
