import { NextResponse } from 'next/server';

/**
 * API endpoint для AI-генерации FAQ
 * 
 * Использует:
 * - Контекст поста (название, content, существующие FAQ)
 * - SEO поля (focus keyphrase, link keywords)
 * - Вопросы из DataForSEO
 * - OpenRouter для генерации ответов
 */

const OPENROUTER_TOKEN = process.env.OPENROUTER_TOKEN;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

type SupportedCollection = 'posts-new' | 'tags-new';

type GenerateFAQRequest = {
  // Контекст поста
  postTitle: string;
  postContent: string; // Lexical JSON или text
  postSummary?: string;
  existingFaqs?: Array<{ question: string; answer: string }>;
  
  // SEO данные
  focusKeyphrase?: string;
  linkKeywords?: string[];
  
  // Вопросы из DataForSEO
  suggestedQuestions?: string[];
  
  // Пользовательский промпт
  userPrompt: string;
  
  // Количество FAQ для генерации
  count?: number;
  
  // Локаль
  locale: string;
  collection?: SupportedCollection;
  descriptionForAI?: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

/**
 * POST /api/generate-faq
 */
export async function POST(request: Request) {
  try {
    const body: GenerateFAQRequest = await request.json();
    
    const {
      postTitle,
      postContent,
      postSummary,
      existingFaqs = [],
      focusKeyphrase,
      linkKeywords = [],
      suggestedQuestions = [],
      userPrompt,
      count = 5,
      locale,
      collection = 'posts-new',
      descriptionForAI,
    } = body;

    if (!OPENROUTER_TOKEN) {
      return NextResponse.json(
        { error: 'OPENROUTER_TOKEN not configured' },
        { status: 500 }
      );
    }

    if (!postTitle || !postContent || !userPrompt) {
      return NextResponse.json(
        { error: 'Missing required fields: postTitle, postContent, userPrompt' },
        { status: 400 }
      );
    }

    console.log(`[Generate FAQ] Request: title="${postTitle}", locale=${locale}, count=${count}, collection=${collection}`);

    // Подготавливаем контекст для AI
    const context = prepareContext({
      postTitle,
      postContent,
      postSummary,
      existingFaqs,
      focusKeyphrase,
      linkKeywords,
      suggestedQuestions,
      locale,
      collection,
      descriptionForAI,
    });

    // Формируем промпт
    const systemPrompt = buildSystemPrompt(locale);
    const userMessage = buildUserMessage(context, userPrompt, count);

    // Вызываем OpenRouter
    const faqs = await generateFAQsWithOpenRouter(systemPrompt, userMessage);

    return NextResponse.json({
      success: true,
      faqs,
      context: {
        suggestedQuestionsCount: suggestedQuestions.length,
        existingFaqsCount: existingFaqs.length,
        collection,
      },
    });

  } catch (error) {
    console.error('[Generate FAQ] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate FAQs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Подготовка контекста для AI
 */
function prepareContext(params: {
  postTitle: string;
  postContent: string;
  postSummary?: string;
  existingFaqs: Array<{ question: string; answer: string }>;
  focusKeyphrase?: string;
  linkKeywords: string[];
  suggestedQuestions: string[];
  locale: string;
  collection: SupportedCollection;
  descriptionForAI?: string;
}) {
  const {
    postTitle,
    postContent,
    postSummary,
    existingFaqs,
    focusKeyphrase,
    linkKeywords,
    suggestedQuestions,
    locale,
    collection,
    descriptionForAI,
  } = params;

  // Извлекаем текст из Lexical JSON (если это JSON)
  let contentText = postContent;
  try {
    const parsed = JSON.parse(postContent);
    if (parsed.root) {
      contentText = extractTextFromLexical(parsed);
    }
  } catch {
    // Не JSON, используем как есть
  }

  // Ограничиваем длину контента
  const maxContentLength = 3000;
  if (contentText.length > maxContentLength) {
    contentText = contentText.substring(0, maxContentLength) + '...';
  }

  return {
    collection,
    locale,
    postTitle,
    postSummary: postSummary || '',
    contentText,
    focusKeyphrase: focusKeyphrase || '',
    linkKeywords,
    existingFaqs,
    suggestedQuestions,
    descriptionForAI: descriptionForAI || '',
  };
}

/**
 * Извлекаем текст из Lexical JSON
 */
function extractTextFromLexical(lexicalData: { root?: unknown }): string {
  const texts: string[] = [];
  
  function traverse(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    
    const nodeObj = node as Record<string, unknown>;
    
    if (typeof nodeObj.text === 'string') {
      texts.push(nodeObj.text);
    }
    
    if (Array.isArray(nodeObj.children)) {
      for (const child of nodeObj.children) {
        traverse(child);
      }
    }
  }
  
  traverse(lexicalData.root);
  return texts.join(' ');
}

/**
 * Формируем system prompt
 */
function buildSystemPrompt(locale: string): string {
  const localeNames: Record<string, string> = {
    en: 'English',
    ru: 'Russian',
    uk: 'Ukrainian',
    fr: 'French',
  };

  const lang = localeNames[locale] || 'English';

  return `You are an expert SEO content writer and FAQ creator for a yachting education website.

Your task is to generate high-quality, engaging FAQ items based on the provided blog post content.

Guidelines:
- Write in ${lang} language
- Questions should be natural and conversational
- Answers should be informative, accurate, and SEO-optimized
- Include relevant keywords naturally
- Keep answers concise but comprehensive (100-300 words)
- Use the post content as source of truth
- Match the tone and style of the existing content
- Focus on user intent and common questions readers might have

**IMPORTANT SEO Requirements:**
- If a Focus Keyphrase is provided, use it EXACTLY ONCE across all FAQ items (in question or answer)
- If Link Keywords are provided, try to use 1-2 of them in EACH FAQ item naturally
- Keywords should fit naturally into the text, not feel forced

Output format: ONLY a valid JSON array with no markdown formatting, no code blocks, no extra text.
Format: [{"question": "...", "answer": "..."}]

IMPORTANT: Ensure all quotes inside question/answer text are properly escaped with backslash.`;
}

/**
 * Формируем user message
 */
function buildUserMessage(context: ReturnType<typeof prepareContext>, userPrompt: string, count: number): string {
  let message = `# Blog Post Context\n\n`;
  message += `**Title:** ${context.postTitle}\n\n`;
  message += `**Collection:** ${context.collection}\n\n`;

  if (context.postSummary) {
    message += `**Summary:** ${context.postSummary}\n\n`;
  }

  if (context.focusKeyphrase) {
    message += `**Focus Keyphrase:** ${context.focusKeyphrase}\n\n`;
  }
  
  if (context.linkKeywords.length > 0) {
    message += `**Link Keywords:** ${context.linkKeywords.join(', ')}\n\n`;
  }
  
  message += `**Content:**\n${context.contentText}\n\n`;

  if (context.descriptionForAI) {
    message += `**Extra Instructions:** ${context.descriptionForAI}\n\n`;
  }
  
  if (context.existingFaqs.length > 0) {
    message += `## Existing FAQs (don't duplicate):\n\n`;
    for (const faq of context.existingFaqs) {
      message += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
    }
  }
  
  if (context.suggestedQuestions.length > 0) {
    message += `## Suggested Questions (from SEO research):\n\n`;
    for (const q of context.suggestedQuestions.slice(0, 10)) {
      message += `- ${q}\n`;
    }
    message += `\n`;
  }
  
  message += `## User Request:\n\n${userPrompt}\n\n`;
  message += `Generate ${count} high-quality FAQ items based on the above context.\n\n`;
  
  if (context.focusKeyphrase) {
    message += `**SEO REQUIREMENT:** Use the Focus Keyphrase "${context.focusKeyphrase}" EXACTLY ONCE across all FAQ items.\n`;
  }
  if (context.linkKeywords.length > 0) {
    message += `**SEO REQUIREMENT:** Try to naturally include 1-2 of these Link Keywords in EACH FAQ: ${context.linkKeywords.join(', ')}\n`;
  }
  message += `\n`;
  message += `Return ONLY a valid JSON array with NO markdown formatting, NO code blocks, NO extra text.\n`;
  message += `Format: [{"question": "...", "answer": "..."}]\n`;
  message += `CRITICAL: Escape all quotes inside text with backslash (\\" not ").`;
  
  return message;
}

/**
 * Генерация FAQ через OpenRouter
 */
async function generateFAQsWithOpenRouter(systemPrompt: string, userMessage: string): Promise<FAQItem[]> {
  console.log('[OpenRouter] Generating FAQs...');
  
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_TOKEN}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://navi.training',
      'X-Title': 'Navi Training FAQ Generator',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5-mini', // ChatGPT 5 Mini (последняя версия)
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content;

  console.log('[OpenRouter] Response received');

  // Парсим JSON из ответа
  const faqs = parseAIResponse(aiResponse);
  
  return faqs;
}

/**
 * Парсим ответ AI (извлекаем JSON)
 */
function parseAIResponse(aiResponse: string): FAQItem[] {
  console.log('[Parse AI] Raw response length:', aiResponse.length);
  console.log('[Parse AI] First 500 chars:', aiResponse.substring(0, 500));
  
  // Убираем markdown code blocks если есть
  let cleaned = aiResponse.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  
  // Ищем JSON массив в ответе
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  
  if (!jsonMatch) {
    console.error('[Parse AI] No JSON array found in response');
    console.error('[Parse AI] Full response:', aiResponse);
    throw new Error('No JSON array found in AI response');
  }

  try {
    // Пытаемся распарсить напрямую
    const faqs = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(faqs)) {
      throw new Error('Response is not an array');
    }

    // Валидируем структуру
    for (const faq of faqs) {
      if (!faq.question || !faq.answer) {
        throw new Error('Invalid FAQ structure: missing question or answer');
      }
    }

    console.log('[Parse AI] Successfully parsed', faqs.length, 'FAQs');
    return faqs;
  } catch (firstError) {
    console.error('[Parse AI] First parse attempt failed:', firstError);
    console.error('[Parse AI] Problematic JSON:', jsonMatch[0].substring(0, 1000));
    
    // Попытка 2: Чиним распространенные проблемы
    try {
      let fixedJson = jsonMatch[0];
      
      // Убираем переносы строк внутри строковых значений (заменяем на пробелы)
      // Это сложная операция, делаем через замену \n на пробел между кавычками
      fixedJson = fixedJson.replace(/"([^"]*?)\n([^"]*?)"/g, '"$1 $2"');
      
      // Убираем trailing commas
      fixedJson = fixedJson.replace(/,\s*([}\]])/g, '$1');
      
      const faqs = JSON.parse(fixedJson);
      
      if (!Array.isArray(faqs)) {
        throw new Error('Response is not an array');
      }

      for (const faq of faqs) {
        if (!faq.question || !faq.answer) {
          throw new Error('Invalid FAQ structure: missing question or answer');
        }
      }

      console.log('[Parse AI] Successfully parsed after fixing', faqs.length, 'FAQs');
      return faqs;
    } catch (secondError) {
      console.error('[Parse AI] Second parse attempt failed:', secondError);
      console.error('[Parse AI] Full AI response:', aiResponse);
      throw new Error(`Failed to parse AI response as JSON. First error: ${firstError instanceof Error ? firstError.message : 'Unknown'}`);
    }
  }
}
