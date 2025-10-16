/**
 * Набор утилит для анализа SEO-текста, подсчёта вхождений ключевых фраз и нормализации лексического контента.
 */

export type FocusKeyphraseStats = {
  inName: boolean;
  inSeoTitle: boolean;
  inMetaDescription: number;
  inSummary: number;
  inContent: number;
  contentPercentage: number;
  inHeadings: number;
  inFaq: number;
  anchorLinksCount: number;
  contentSignature: string | null;
  updatedAt: string | null;
};

export type KeywordEntry = {
  keyword: string;
  notes?: string;
  linksCount?: number;
  potentialLinksCount?: number;
  cachedTotal?: number;
  cachedHeadings?: number;
  linkDetails?: Array<{
    collection: string;
    count: number;
    documents?: Array<{
      id: string | number;
      title?: string;
      count: number;
    }>;
  }>;
  potentialDetails?: Array<{
    collection: string;
    count: number;
    documents?: Array<{
      id: string | number;
      title?: string;
      count: number;
    }>;
  }>;
};

export type AdditionalFieldsValue = {
  keywords: KeywordEntry[];
  statsSignature?: string;
  statsUpdatedAt?: string;
};

export function ensureKeywordEntry(entry: KeywordEntry): KeywordEntry {
  return {
    keyword: (entry.keyword ?? '').trim(),
    notes: entry.notes ?? '',
    linksCount: Number.isFinite(entry.linksCount) ? Number(entry.linksCount) || 0 : 0,
    potentialLinksCount: Number.isFinite(entry.potentialLinksCount) ? Number(entry.potentialLinksCount) || 0 : 0,
    cachedTotal: Number.isFinite(entry.cachedTotal) ? Number(entry.cachedTotal) || 0 : 0,
    cachedHeadings: Number.isFinite(entry.cachedHeadings) ? Number(entry.cachedHeadings) || 0 : 0,
  };
}

export function serializeKeywords(keywords: KeywordEntry[]): string {
  return keywords
    .map((entry) => entry.keyword?.trim())
    .filter((keyword): keyword is string => Boolean(keyword))
    .join(', ');
}

export function normalizeAdditionalValue(
  additional: AdditionalFieldsValue | null | undefined,
  serialized: string,
): AdditionalFieldsValue {
  const base: AdditionalFieldsValue = additional
    ? {
        keywords: Array.isArray(additional.keywords)
          ? additional.keywords.map(ensureKeywordEntry)
          : [],
        statsSignature: additional.statsSignature,
        statsUpdatedAt: additional.statsUpdatedAt,
      }
    : { keywords: [] };

  if (base.keywords.length > 0) {
    return base;
  }

  const parsed = serialized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map<KeywordEntry>((keyword) => ({
      keyword,
      notes: '',
      linksCount: 0,
      cachedTotal: 0,
      cachedHeadings: 0,
    }));

  if (parsed.length === 0) {
    return base;
  }

  return {
    ...base,
    keywords: parsed,
  };
}

export type NormalizedToken = {
  value: string;
  isStopWord: boolean;
};

export type SeoContentContext = {
  name: string;
  seoTitle: string;
  metaDescription: string;
  summary: string;
  contentText: string;
  contentTokens: NormalizedToken[];
  headingsText: string[];
  headingsTokens: NormalizedToken[][];
  faqText: string;
  additionalFields?: AdditionalFieldsValue | null;
};

export type SeoFieldCandidates = {
  stats: string[];
  focusKeyphrase: string[];
  seoTitle: string[];
  metaDescription: string[];
  additionalFields: string[];
  linkKeywords: string[];
  name: string[];
  summary: string[];
  content: string[];
  faqs: string[];
};

function ensureUnique(list: string[]): string[] {
  return Array.from(new Set(list.filter(Boolean)));
}

export function deriveSeoFieldCandidates(statsFieldPath?: string): SeoFieldCandidates {
  const segments = statsFieldPath ? statsFieldPath.split('.') : [];
  const seoIndex = segments.lastIndexOf('seo');
  const baseSegments = seoIndex >= 0 ? segments.slice(0, seoIndex + 1) : ['seo'];
  const ancestorSegments = seoIndex >= 0 ? segments.slice(0, seoIndex) : [];
  const basePath = baseSegments.join('.');
  const ancestorPath = ancestorSegments.join('.');

  const stats = ensureUnique([
    statsFieldPath ?? '',
    `${basePath}.focus_keyphrase_stats`,
    'seo.focus_keyphrase_stats',
  ]);

  const focusKeyphrase = ensureUnique([
    `${basePath}.focus_keyphrase`,
    'seo.focus_keyphrase',
  ]);

  const seoTitle = ensureUnique([
    `${basePath}.title`,
    `${basePath}.seo_title`,
    'seo.title',
  ]);

  const metaDescription = ensureUnique([
    `${basePath}.meta_description`,
    `${basePath}.metaDescription`,
    'seo.meta_description',
  ]);

  const additionalFields = ensureUnique([
    `${basePath}.additional_fields`,
    'seo.additional_fields',
  ]);

  const linkKeywords = ensureUnique([
    `${basePath}.link_keywords`,
    `${basePath}.linkKeywords`,
    'seo.link_keywords',
  ]);

  const name = ensureUnique([
    `${ancestorPath}.name`,
    'name',
    `${basePath}.name`,
  ]);

  const summary = ensureUnique([
    `${ancestorPath}.summary`,
    'summary',
  ]);

  const content = ensureUnique([
    `${ancestorPath}.content`,
    'content',
  ]);

  const faqs = ensureUnique([
    `${ancestorPath}.faqs`,
    'faqs',
  ]);

  return {
    stats,
    focusKeyphrase,
    seoTitle,
    metaDescription,
    additionalFields,
    linkKeywords,
    name,
    summary,
    content,
    faqs,
  };
}

const NORMALIZATION_MAP: Record<string, string> = {
  ё: 'е',
  й: 'и',
  ѣ: 'е',
  ґ: 'г',
  ї: 'и',
  і: 'и',
  є: 'е',
  ô: 'o',
};

const STOP_WORDS = new Set([
  'и',
  'а',
  'но',
  'или',
  'в',
  'на',
  'с',
  'во',
  'за',
  'для',
  'от',
  'до',
  'из',
  'у',
  'по',
  'об',
  'о',
  'при',
  'через',
  'над',
  'под',
  'между',
  'to',
  'the',
  'and',
  'or',
  'of',
]);

const STEM_SUFFIXES = [
  'иями',
  'ями',
  'ием',
  'ием',
  'ами',
  'ями',
  'его',
  'ого',
  'ему',
  'ому',
  'ей',
  'ой',
  'ий',
  'ый',
  'ия',
  'ие',
  'ые',
  'ые',
  'ая',
  'ое',
  'ью',
  'ью',
  'ям',
  'ах',
  'ях',
  'ем',
  'ом',
  'ев',
  'ов',
  'ие',
  'ей',
  'ам',
  'ям',
  'ия',
  'иям',
  'иями',
  'иях',
  'ть',
  'ти',
  'тья',
  'ться',
  'ться',
  'ться',
  'юсь',
  'ешь',
  'ет',
  'ют',
  'ем',
  'им',
  'ешься',
  'ится',
  'емся',
  'итесь',
  'ются',
  'ение',
  'ений',
  'ению',
  'ением',
  'ении',
  'ing',
  'ed',
  'ies',
  'es',
  's',
];

const TOKEN_REGEX = /[\p{L}\p{N}]+/gu;

// Нормализация британского/американского английского
const BRITISH_TO_AMERICAN: Array<[RegExp, string]> = [
  [/licence/g, 'license'],
  [/colour/g, 'color'],
  [/favour/g, 'favor'],
  [/honour/g, 'honor'],
  [/labour/g, 'labor'],
  [/neighbour/g, 'neighbor'],
  [/centre/g, 'center'],
  [/theatre/g, 'theater'],
  [/metre/g, 'meter'],
  [/litre/g, 'liter'],
  [/fibre/g, 'fiber'],
  [/calibre/g, 'caliber'],
  [/defence/g, 'defense'],
  [/offence/g, 'offense'],
  [/pretence/g, 'pretense'],
];

export function normalizeText(value: string): string {
  let lowered = value.toLowerCase();
  
  // Нормализуем британский → американский английский
  for (const [british, american] of BRITISH_TO_AMERICAN) {
    lowered = lowered.replace(british, american);
  }
  
  // Нормализуем диакритику (кириллица, французский и т.д.)
  let result = '';
  for (let i = 0; i < lowered.length; i++) {
    const char = lowered[i];
    result += NORMALIZATION_MAP[char] ?? char;
  }
  return result;
}

export function stemToken(token: string): string {
  let result = token;
  for (const suffix of STEM_SUFFIXES) {
    if (result.length <= suffix.length + 2) continue;
    if (result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length);
      break;
    }
  }
  return result;
}

export function tokenizeForSeo(raw: string): NormalizedToken[] {
  if (!raw) return [];
  const normalized = normalizeText(raw);
  const tokens: NormalizedToken[] = [];
  let match: RegExpExecArray | null;
  while ((match = TOKEN_REGEX.exec(normalized)) !== null) {
    const base = stemToken(match[0]);
    if (!base) continue;
    const isStopWord = STOP_WORDS.has(base);
    tokens.push({ value: base, isStopWord });
  }
  return tokens;
}

export function countKeywordOccurrences(keyword: string, tokens: NormalizedToken[]): number {
  const keywordTokens = tokenizeForSeo(keyword).filter((token) => !STOP_WORDS.has(token.value));
  if (!keywordTokens.length || !tokens.length) return 0;
  let count = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value !== keywordTokens[0].value) continue;
    let matchIndex = 1;
    let j = i + 1;
    let skipped = 0;
    while (matchIndex < keywordTokens.length && j < tokens.length) {
      const current = tokens[j];
      if (current.value === keywordTokens[matchIndex].value) {
        matchIndex++;
      } else if (current.isStopWord) {
        skipped++;
        if (skipped > 3) break;
      } else {
        break;
      }
      j++;
    }
    if (matchIndex === keywordTokens.length) {
      count++;
      i = j - 1;
    }
  }
  return count;
}

export function countTokens(tokens: NormalizedToken[], skipStopWords = false): number {
  if (!skipStopWords) return tokens.length;
  return tokens.filter((token) => !token.isStopWord).length;
}

function collectLexicalText(node: unknown, accumulator: string[], headings: string[]): void {
  if (!node || typeof node !== 'object') return;
  const value = node as Record<string, unknown>;
  if (typeof value.text === 'string') {
    accumulator.push(value.text);
  }
  if (value.type === 'heading') {
    const headingParts: string[] = [];
    collectHeadingText(value, headingParts);
    const joined = headingParts.join(' ').trim();
    if (joined) headings.push(joined);
  }
  const children = value.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      collectLexicalText(child, accumulator, headings);
    }
  }
}

function collectHeadingText(node: Record<string, unknown>, parts: string[]): void {
  if (typeof node.text === 'string') {
    parts.push(node.text);
  }
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      if (child && typeof child === 'object') {
        collectHeadingText(child as Record<string, unknown>, parts);
      }
    }
  }
}

export function extractTextFromLexical(value: unknown): { text: string; headings: string[] } {
  if (!value) {
    return { text: '', headings: [] };
  }
  if (typeof value === 'string') {
    return { text: value, headings: [] };
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.root === 'object' && record.root !== null) {
      const accumulator: string[] = [];
      const headings: string[] = [];
      collectLexicalText(record.root, accumulator, headings);
      return { text: accumulator.join(' ').trim(), headings };
    }
  }
  return { text: '', headings: [] };
}

export function extractFaqText(value: unknown): string {
  if (!value) return '';
  const chunks: string[] = [];
  const source = Array.isArray(value) ? value : [value];
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const data = (record.value && typeof record.value === 'object') ? (record.value as Record<string, unknown>) : record;
    const question = typeof data.question === 'string' ? data.question : '';
    const answer = typeof data.answer === 'string' ? data.answer : '';
    if (question) chunks.push(question);
    if (answer) chunks.push(answer);
  }
  return chunks.join(' ');
}

export function createContentSignature(chunks: unknown[]): string {
  const serialized = JSON.stringify(chunks);
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const chr = serialized.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `sig_${Math.abs(hash)}`;
}

export function parseAdditionalFields(value: unknown): AdditionalFieldsValue {
  if (!value || typeof value !== 'object') {
    return { keywords: [] };
  }
  const record = value as Record<string, unknown>;
  const rawKeywords = Array.isArray(record.keywords) ? record.keywords : [];
  const keywords: KeywordEntry[] = rawKeywords
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const obj = entry as Record<string, unknown>;
      return {
        keyword: typeof obj.keyword === 'string' ? obj.keyword : '',
        notes: typeof obj.notes === 'string' ? obj.notes : undefined,
        linksCount: typeof obj.linksCount === 'number' ? obj.linksCount : Number(obj.linksCount ?? 0) || 0,
        cachedTotal: typeof obj.cachedTotal === 'number' ? obj.cachedTotal : Number(obj.cachedTotal ?? 0) || 0,
        cachedHeadings: typeof obj.cachedHeadings === 'number' ? obj.cachedHeadings : Number(obj.cachedHeadings ?? 0) || 0,
      } as KeywordEntry;
    })
    .filter((entry): entry is KeywordEntry => Boolean(entry));
  return {
    keywords,
    statsSignature: typeof record.statsSignature === 'string' ? record.statsSignature : undefined,
    statsUpdatedAt: typeof record.statsUpdatedAt === 'string' ? record.statsUpdatedAt : undefined,
  };
}

export function buildSeoContentContext(params: {
  name?: string;
  seoTitle?: string;
  metaDescription?: string;
  summary?: string;
  content?: unknown;
  faqs?: unknown;
  additionalFields?: unknown;
}): SeoContentContext {
  const { text: contentText, headings } = extractTextFromLexical(params.content);
  const faqText = extractFaqText(params.faqs);
  return {
    name: params.name ?? '',
    seoTitle: params.seoTitle ?? '',
    metaDescription: params.metaDescription ?? '',
    summary: params.summary ?? '',
    contentText,
    contentTokens: tokenizeForSeo(contentText),
    headingsText: headings,
    headingsTokens: headings.map((heading) => tokenizeForSeo(heading)),
    faqText,
    additionalFields: parseAdditionalFields(params.additionalFields),
  };
}

function containsKeyword(keyword: string, target: string): boolean {
  if (!keyword || !target) return false;
  const normalizedKeyword = tokenizeForSeo(keyword)
    .filter((token) => !token.isStopWord)
    .map((token) => token.value)
    .join(' ');
  if (!normalizedKeyword) return false;
  const normalizedTarget = tokenizeForSeo(target).map((token) => token.value).join(' ');
  return normalizedTarget.includes(normalizedKeyword);
}

function statsEqual(a: FocusKeyphraseStats | null | undefined, b: FocusKeyphraseStats): boolean {
  if (!a) return false;
  return (
    a.inName === b.inName &&
    a.inSeoTitle === b.inSeoTitle &&
    a.inMetaDescription === b.inMetaDescription &&
    a.inSummary === b.inSummary &&
    a.inContent === b.inContent &&
    Number(a.contentPercentage.toFixed(2)) === Number(b.contentPercentage.toFixed(2)) &&
    a.inHeadings === b.inHeadings &&
    a.inFaq === b.inFaq &&
    a.anchorLinksCount === b.anchorLinksCount &&
    a.contentSignature === b.contentSignature
  );
}

export function computeFocusKeyphraseStats(input: {
  focusKeyphrase: string;
  context: SeoContentContext;
  previous?: FocusKeyphraseStats | null;
}): FocusKeyphraseStats {
  const { focusKeyphrase, context, previous } = input;
  if (!focusKeyphrase.trim()) {
    return previous ?? {
      inName: false,
      inSeoTitle: false,
      inMetaDescription: 0,
      inSummary: 0,
      inContent: 0,
      contentPercentage: 0,
      inHeadings: 0,
      inFaq: 0,
      anchorLinksCount: 0,
      contentSignature: null,
      updatedAt: null,
    };
  }
  const keyword = focusKeyphrase.trim();
  const metaTokens = tokenizeForSeo(context.metaDescription);
  const summaryTokens = tokenizeForSeo(context.summary);
  const faqTokens = tokenizeForSeo(context.faqText);

  const inContent = countKeywordOccurrences(keyword, context.contentTokens);
  const totalPortableTokens = countTokens(context.contentTokens, true) || 1;
  const contentPercentage = Number(((inContent / totalPortableTokens) * 100).toFixed(2));

  const signature = createContentSignature([
    keyword,
    context.name,
    context.seoTitle,
    context.metaDescription,
    context.summary,
    context.contentText,
    context.headingsText,
    context.faqText,
    context.additionalFields?.keywords?.map((entry) => entry.keyword) ?? [],
  ]);

  const next: FocusKeyphraseStats = {
    inName: containsKeyword(keyword, context.name),
    inSeoTitle: containsKeyword(keyword, context.seoTitle),
    inMetaDescription: countKeywordOccurrences(keyword, metaTokens),
    inSummary: countKeywordOccurrences(keyword, summaryTokens),
    inContent,
    contentPercentage,
    inHeadings: context.headingsTokens.reduce((acc, tokens) => acc + countKeywordOccurrences(keyword, tokens), 0),
    inFaq: countKeywordOccurrences(keyword, faqTokens),
    anchorLinksCount: (context.additionalFields?.keywords ?? []).reduce((acc, entry) => acc + (entry.linksCount ?? 0), 0),
    contentSignature: signature,
    updatedAt: new Date().toISOString(),
  };

  if (statsEqual(previous, next)) {
    return previous as FocusKeyphraseStats;
  }

  return {
    ...next,
    updatedAt: new Date().toISOString(),
  };
}

export function enrichKeywordEntries(params: {
  keywords: KeywordEntry[];
  context: SeoContentContext;
  previous?: AdditionalFieldsValue | null;
}): { value: AdditionalFieldsValue; changed: boolean } {
  const { keywords, context, previous } = params;
  const signature = createContentSignature([
    context.contentText,
    context.headingsText,
    context.summary,
    context.metaDescription,
  ]);

  const enriched = keywords.map((entry) => {
    const keyword = entry.keyword ?? '';
    const total = countKeywordOccurrences(keyword, context.contentTokens);
    const headingsCount = context.headingsTokens.reduce(
      (acc, tokens) => acc + countKeywordOccurrences(keyword, tokens),
      0,
    );
    return {
      keyword,
      notes: entry.notes ?? '',
      linksCount: entry.linksCount ?? 0,
      cachedTotal: total,
      cachedHeadings: headingsCount,
    };
  });

  const next: AdditionalFieldsValue = {
    keywords: enriched,
    statsSignature: signature,
    statsUpdatedAt: previous?.statsSignature === signature ? previous?.statsUpdatedAt : new Date().toISOString(),
  };

  return {
    value: next,
    changed: !deepEqual(previous, next),
  };
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (!a || !b) return false;
  if (typeof a !== 'object') return false;
  const aEntries = Object.entries(a as Record<string, unknown>);
  const bEntries = Object.entries(b as Record<string, unknown>);
  if (aEntries.length !== bEntries.length) return false;
  for (const [key, value] of aEntries) {
    if (!deepEqual((b as Record<string, unknown>)[key], value)) return false;
  }
  return true;
}
export type FormFieldState = {
  value?: unknown;
  initialValue?: unknown;
};

export function resolveFieldValue(
  fields: Record<string, FormFieldState | undefined>,
  keyOrKeys: string | string[] | undefined,
): unknown {
  if (!fields || !keyOrKeys) return undefined;
  const candidates = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
  const normalized = candidates.filter((candidate): candidate is string => Boolean(candidate));
  const keys = Object.keys(fields);

  const tryKey = (key: string): unknown => {
    const direct = fields[key];
    if (direct) {
      return direct.value ?? direct.initialValue;
    }
    const fallback = keys.find((candidate) => candidate === key || candidate.endsWith(`.${key}`));
    if (fallback && fields[fallback]) {
      const field = fields[fallback]!;
      return field.value ?? field.initialValue;
    }
    return undefined;
  };

  for (const key of normalized) {
    const resolved = tryKey(key);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return undefined;
}
