/**
 * Конфигурация для анализа ссылок и потенциальных мест
 * 
 * Определяет какие коллекции и поля участвуют в подсчете:
 * - Внутренних ссылок (ссылки с данным анкором)
 * - Потенциальных ссылок (упоминания без ссылки)
 */

export type FieldToAnalyze = string;

export type CollectionToAnalyze = {
  /** Slug коллекции */
  slug: string;
  /** Lexical поля для анализа */
  fields: FieldToAnalyze[];
  /** Описание для документации */
  description?: string;
};

/**
 * Коллекции и поля для анализа ссылок
 * 
 * Поля:
 * - Lexical поля указываются в fields
 * - FAQ анализируются автоматически (поле faqs с answer)
 * 
 * @example
 * // Для posts-new анализируем content, summary + FAQ автоматически
 * { slug: 'posts-new', fields: ['content', 'summary'] }
 */
export const COLLECTIONS_TO_ANALYZE: readonly CollectionToAnalyze[] = [
  {
    slug: 'posts-new',
    fields: ['content', 'summary'],
    description: 'Posts: Content, Summary, FAQ (Answer)',
  },
  {
    slug: 'tags-new',
    fields: ['content', 'summary'],
    description: 'Tags: Content, Summary, FAQ (Answer)',
  },
  {
    slug: 'team-new',
    fields: ['bio', 'bio_summary'],
    description: 'Team: Biography, Bio Summary, FAQ (Answer)',
  },
  {
    slug: 'certificates',
    fields: ['content', 'requirements', 'program'],
    description: 'Certificates: Description (content), Requirements, Program, FAQ (Answer)',
  },
] as const;

/**
 * Проверяет включена ли коллекция в анализ
 */
export function isCollectionEnabled(slug: string): boolean {
  return COLLECTIONS_TO_ANALYZE.some(c => c.slug === slug);
}

/**
 * Получает поля для анализа по slug коллекции
 */
export function getFieldsForCollection(slug: string): FieldToAnalyze[] {
  const collection = COLLECTIONS_TO_ANALYZE.find(c => c.slug === slug);
  return collection ? collection.fields : [];
}

/**
 * Получает список всех коллекций для анализа
 */
export function getAllCollections(): readonly CollectionToAnalyze[] {
  return COLLECTIONS_TO_ANALYZE;
}
