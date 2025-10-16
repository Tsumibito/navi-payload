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

    console.log(`[Generate FAQ] Request: title="${postTitle}", locale=${locale}, count=${count}`);

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
  } = params;

  // Извлекаем текст из Lexical JSON (если это JSON)
  let contentText = postContent;
  try {
    const parsed = JSON.parse(postContent);
    if (parsed.root) {
      contentText = extractTextFromLexical(parsed);
    }
  } catch (e) {
    // Не JSON, используем как есть
  }

  // Ограничиваем длину контента
  const maxContentLength = 3000;
  if (contentText.length > maxContentLength) {
    contentText = contentText.substring(0, maxContentLength) + '...';
  }

  return {
    locale,
    postTitle,
    postSummary: postSummary || '',
    contentText,
    focusKeyphrase: focusKeyphrase || '',
    linkKeywords,
    existingFaqs,
    suggestedQuestions,
  };
}

/**
 * Извлекаем текст из Lexical JSON
 */
function extractTextFromLexical(lexicalData: any): string {
  const texts: string[] = [];
  
  function traverse(node: any) {
    if (!node) return;
    
    if (node.text) {
      texts.push(node.text);
    }
    
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
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

Output format: JSON array of objects with "question" and "answer" fields.`;
}

/**
 * Формируем user message
 */
function buildUserMessage(context: any, userPrompt: string, count: number): string {
  let message = `# Blog Post Context\n\n`;
  message += `**Title:** ${context.postTitle}\n\n`;
  
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
  message += `Return ONLY a valid JSON array in this exact format:\n`;
  message += `[\n  {"question": "...", "answer": "..."},\n  {"question": "...", "answer": "..."}\n]`;
  
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
  // Ищем JSON массив в ответе
  const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
  
  if (!jsonMatch) {
    throw new Error('No JSON array found in AI response');
  }

  try {
    const faqs = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(faqs)) {
      throw new Error('Response is not an array');
    }

    // Валидируем структуру
    for (const faq of faqs) {
      if (!faq.question || !faq.answer) {
        throw new Error('Invalid FAQ structure');
      }
    }

    return faqs;
  } catch (error) {
    console.error('[Parse AI] Error parsing JSON:', error);
    throw new Error('Failed to parse AI response as JSON');
  }
}
