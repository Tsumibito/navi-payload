/**
 * Утилиты для анализа ссылок в Lexical контенте
 */

type LexicalNode = {
  type: string;
  children?: LexicalNode[];
  text?: string;
  url?: string;
  fields?: {
    doc?: {
      value?: string | { id?: string | number };
      relationTo?: string;
    };
    linkType?: string;
  };
  [key: string]: unknown;
};

type LexicalContent = {
  root?: {
    children?: LexicalNode[];
  };
  [key: string]: unknown;
};

export type LinkMatch = {
  url: string;
  anchorText: string;
  relationTo?: string;
  docId?: string | number;
};

export type MentionMatch = {
  text: string;
  position: number;
};

/**
 * Извлекает текст из узла Lexical (рекурсивно)
 */
function extractNodeText(node: LexicalNode): string {
  if (node.text) {
    return node.text;
  }
  
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(extractNodeText).join('');
  }
  
  return '';
}

/**
 * Находит все ссылки в Lexical контенте
 */
export function findLinksInLexical(content: unknown): LinkMatch[] {
  if (!content || typeof content !== 'object') {
    return [];
  }

  const lexicalContent = content as LexicalContent;
  const links: LinkMatch[] = [];

  function traverse(node: LexicalNode) {
    // Проверяем тип ссылки
    if (node.type === 'link' || node.type === 'autolink') {
      const anchorText = extractNodeText(node);
      const url = node.url || '';
      
      links.push({
        url,
        anchorText,
      });
    }

    // Проверяем внутренние ссылки на документы
    if (node.fields?.doc) {
      const doc = node.fields.doc;
      const anchorText = extractNodeText(node);
      
      let docId: string | number | undefined;
      if (typeof doc.value === 'object' && doc.value?.id) {
        docId = doc.value.id;
      } else if (typeof doc.value === 'string' || typeof doc.value === 'number') {
        docId = doc.value;
      }

      if (docId) {
        links.push({
          url: `/${doc.relationTo}/${docId}`,
          anchorText,
          relationTo: doc.relationTo,
          docId,
        });
      }
    }

    // Рекурсивно обходим дочерние узлы
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  }

  if (lexicalContent.root?.children) {
    lexicalContent.root.children.forEach(traverse);
  }

  return links;
}

/**
 * Извлекает весь текст из Lexical контента
 */
export function extractTextFromLexical(content: unknown): string {
  if (!content || typeof content !== 'object') {
    return '';
  }

  const lexicalContent = content as LexicalContent;
  
  function traverse(node: LexicalNode): string {
    if (node.text) {
      return node.text;
    }
    
    if (node.children && Array.isArray(node.children)) {
      return node.children.map(traverse).join(' ');
    }
    
    return '';
  }

  if (lexicalContent.root?.children) {
    return lexicalContent.root.children.map(traverse).join(' ');
  }

  return '';
}

/**
 * Находит упоминания анкора в тексте (без учета ссылок)
 */
export function findAnchorMentions(text: string, anchor: string): MentionMatch[] {
  if (!text || !anchor) {
    return [];
  }

  const mentions: MentionMatch[] = [];
  const normalizedText = text.toLowerCase();
  const normalizedAnchor = anchor.toLowerCase();
  
  let position = 0;
  while (true) {
    position = normalizedText.indexOf(normalizedAnchor, position);
    if (position === -1) break;
    
    mentions.push({
      text: anchor,
      position,
    });
    
    position += normalizedAnchor.length;
  }

  return mentions;
}

/**
 * Подсчитывает существующие ссылки с данным анкором
 * (упрощенная версия - просто считаем ссылки с таким анкором, без проверки цели)
 */
export function countExistingLinks(
  links: LinkMatch[],
  anchor: string,
  targetDocId?: string | number,
  targetCollection?: string,
  targetSlug?: string
): number {
  const normalizedAnchor = anchor.toLowerCase().trim();
  
  return links.filter((link) => {
    // Проверяем только совпадение анкора
    return link.anchorText.toLowerCase().trim() === normalizedAnchor;
  }).length;
}

/**
 * Подсчитывает потенциальные места для ссылок (упоминания анкора без ссылки)
 */
export function countPotentialLinks(
  content: unknown,
  anchor: string,
  existingLinksCount: number
): number {
  const text = extractTextFromLexical(content);
  const mentions = findAnchorMentions(text, anchor);
  
  // Потенциальные = все упоминания - существующие ссылки
  const potential = mentions.length - existingLinksCount;
  return Math.max(0, potential);
}
