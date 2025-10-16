import { NextResponse } from 'next/server';

/**
 * API endpoint для получения данных из DataForSEO
 * 
 * Поддерживает:
 * 1. Keyword Ideas (связанные вопросы)
 * 2. SERP People Also Ask (вопросы от Google)
 */

// DATAFORSEO_API_KEY уже содержит base64(login:password)
const DATAFORSEO_API_KEY = process.env.DATAFORSEO_API_KEY;
const DATAFORSEO_BASE_URL = 'https://api.dataforseo.com';

type DataForSEORequest = {
  type: 'keyword_ideas' | 'people_also_ask';
  keyword: string;
  language_code: string; // 'en', 'ru', 'uk', 'fr'
  location?: string; // 'France', 'United States', etc.
};

/**
 * POST /api/dataforseo
 */
export async function POST(request: Request) {
  try {
    const body: DataForSEORequest = await request.json();
    const { type, keyword, language_code, location } = body;

    if (!DATAFORSEO_API_KEY) {
      return NextResponse.json(
        { error: 'DATAFORSEO_API_KEY not configured' },
        { status: 500 }
      );
    }

    if (!keyword || !language_code) {
      return NextResponse.json(
        { error: 'Missing required fields: keyword, language_code' },
        { status: 400 }
      );
    }

    console.log(`[DataForSEO] Request: type=${type}, keyword="${keyword}", lang=${language_code}`);

    // Определяем location_name на основе языка и пользовательского input
    const locationName = location || getDefaultLocation(language_code);

    if (type === 'keyword_ideas') {
      return await getKeywordIdeas(keyword, language_code, locationName);
    } else if (type === 'people_also_ask') {
      return await getPeopleAlsoAsk(keyword, language_code, locationName);
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Use: keyword_ideas or people_also_ask' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[DataForSEO] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Получаем связанные вопросы через Keyword Ideas
 */
async function getKeywordIdeas(keyword: string, languageCode: string, locationName: string) {
  const endpoint = '/v3/keywords_data/google_ads/keywords_for_keywords/task_post';

  const payload = [
    {
      keywords: [keyword],
      language_code: languageCode,
      location_name: locationName,
      include_seed_keyword: true,
      sort_by: 'relevance',
    },
  ];

  const response = await callDataForSEO(endpoint, payload);
  
  // Фильтруем только вопросительные keywords
  const questions = extractQuestions(response);

  return NextResponse.json({
    type: 'keyword_ideas',
    keyword,
    language_code: languageCode,
    location_name: locationName,
    questions,
    raw: response,
  });
}

/**
 * Получаем "People Also Ask" через Google SERP
 */
async function getPeopleAlsoAsk(keyword: string, languageCode: string, locationName: string) {
  const endpoint = '/v3/serp/google/organic/task_post';

  const payload = [
    {
      keyword,
      language_code: languageCode,
      location_name: locationName,
      device: 'desktop',
    },
  ];

  const response = await callDataForSEO(endpoint, payload);
  
  // Извлекаем PAA вопросы из SERP результатов
  const paaQuestions = extractPeopleAlsoAsk(response);

  return NextResponse.json({
    type: 'people_also_ask',
    keyword,
    language_code: languageCode,
    location_name: locationName,
    questions: paaQuestions,
    raw: response,
  });
}

/**
 * Вызов DataForSEO API
 */
async function callDataForSEO(endpoint: string, payload: any[]) {
  const url = `${DATAFORSEO_BASE_URL}${endpoint}`;
  // DATAFORSEO_API_KEY уже в base64 формате (login:password)
  const auth = DATAFORSEO_API_KEY;

  console.log(`[DataForSEO] Calling: ${endpoint}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DataForSEO API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  console.log(`[DataForSEO] Response status: ${data.status_code}, tasks: ${data.tasks?.length || 0}`);

  return data;
}

/**
 * Извлекаем вопросы из Keyword Ideas ответа
 */
function extractQuestions(response: any): string[] {
  const questions: string[] = [];

  if (response.tasks && response.tasks.length > 0) {
    const task = response.tasks[0];
    if (task.result && task.result.length > 0) {
      const keywords = task.result[0].keywords || [];
      
      for (const item of keywords) {
        const kw = item.keyword || '';
        // Фильтруем только вопросы (начинаются с вопросительных слов)
        if (isQuestion(kw)) {
          questions.push(kw);
        }
      }
    }
  }

  return questions;
}

/**
 * Извлекаем People Also Ask из SERP ответа
 */
function extractPeopleAlsoAsk(response: any): Array<{ question: string; answer?: string }> {
  const paaItems: Array<{ question: string; answer?: string }> = [];

  if (response.tasks && response.tasks.length > 0) {
    const task = response.tasks[0];
    if (task.result && task.result.length > 0) {
      const items = task.result[0].items || [];
      
      for (const item of items) {
        if (item.type === 'people_also_ask' && item.items) {
          for (const paaItem of item.items) {
            paaItems.push({
              question: paaItem.title || paaItem.question || '',
              answer: paaItem.description || paaItem.answer,
            });
          }
        }
      }
    }
  }

  return paaItems;
}

/**
 * Проверка, является ли строка вопросом
 */
function isQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim();
  
  // Английский
  if (lower.match(/^(what|why|how|when|where|who|which|can|is|are|do|does|should|will|would)\s/)) {
    return true;
  }
  
  // Русский
  if (lower.match(/^(что|почему|как|когда|где|кто|какой|можно|является|есть|должен|будет|стоит)\s/)) {
    return true;
  }
  
  // Украинский
  if (lower.match(/^(що|чому|як|коли|де|хто|який|можна|є|чи|повинен|буде)\s/)) {
    return true;
  }
  
  // Французский
  if (lower.match(/^(quel|quoi|pourquoi|comment|quand|où|qui|est-ce|peut-on|dois-je)\s/)) {
    return true;
  }
  
  // Заканчивается на "?"
  if (text.trim().endsWith('?')) {
    return true;
  }
  
  return false;
}

/**
 * Определяем дефолтную локацию по языку
 */
function getDefaultLocation(languageCode: string): string {
  const locationMap: Record<string, string> = {
    'en': 'United States',
    'ru': 'Russia',
    'uk': 'Ukraine',
    'fr': 'France',
    'es': 'Spain',
    'it': 'Italy',
    'de': 'Germany',
    'pt': 'Portugal',
    'nl': 'Netherlands',
    'el': 'Greece',
    'hr': 'Croatia',
  };

  return locationMap[languageCode] || 'United States';
}
