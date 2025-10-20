import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_TOKEN = process.env.OPENROUTER_TOKEN;
const CYRILLIC_REGEX = /[А-Яа-яЁёІіЇїЄєҐґ]/g;

class TranslationValidationError extends Error {
  meta?: Record<string, unknown>;

  constructor(message: string, meta?: Record<string, unknown>) {
    super(message);
    this.name = 'TranslationValidationError';
    this.meta = meta;
  }
}

type FAQ = {
  id?: string; // ID для синхронизации между локалями
  question: string;
  answer: string;
};

type TranslationRequest = {
  faqs: FAQ[];
  fromLocale: string;
  toLocale: string;
};

export async function POST(request: NextRequest) {
  try {
    const body: TranslationRequest = await request.json();
    const { faqs, fromLocale, toLocale } = body;

    if (!faqs || !Array.isArray(faqs) || faqs.length === 0) {
      return NextResponse.json(
        { error: 'Invalid faqs array' },
        { status: 400 }
      );
    }

    if (!OPENROUTER_TOKEN) {
      return NextResponse.json(
        { error: 'OPENROUTER_TOKEN not configured' },
        { status: 500 }
      );
    }

    console.log(`\n=== [Translate FAQs] START ===`);
    console.log(`From: ${fromLocale} → To: ${toLocale}`);
    console.log(`Total FAQs to translate: ${faqs.length}`);
    faqs.forEach((faq, i) => {
      console.log(`FAQ #${i}: Q="${faq.question.substring(0, 60)}..."`);
    });

    const startTime = Date.now();

    const localeNames: Record<string, string> = {
      en: 'English',
      ru: 'Russian',
      uk: 'Ukrainian',
    };

    const fromLang = localeNames[fromLocale] || fromLocale;
    const toLang = localeNames[toLocale] || toLocale;

    // Формируем промпт
    const faqsText = faqs.map((faq, i) => 
      `FAQ #${i + 1}:\nQ: ${faq.question}\nA: ${faq.answer}`
    ).join('\n\n');

    const systemPrompt = `You are a professional translator. Translate from ${fromLang} to ${toLang}. 
Return ONLY a valid JSON array with ${faqs.length} items.
Each item must have "question" and "answer" fields with translated text.
CRITICAL: Escape any double quotes in the translated text using backslash: \\".
Use ONLY double quotes for JSON syntax, never single quotes.
IMPORTANT: You MUST translate ALL ${faqs.length} FAQs!`;

    const userPrompt = `Translate ALL of these ${faqs.length} FAQs from ${fromLang} to ${toLang}:\n\n${faqsText}\n\nReturn ONLY a valid JSON array with proper escaping: [{"question": "text with \\"quotes\\"", "answer": "..."}, ...]`;

    console.log(`\n[Translate FAQs] Sending to GPT:`);
    console.log(`System prompt: "${systemPrompt.substring(0, 150)}..."`);
    console.log(`User prompt length: ${userPrompt.length} chars`);
    console.log(`User prompt preview: "${userPrompt.substring(0, 200)}..."`);

    // Создаём AbortController для таймаута
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let response;
    try {
      response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_TOKEN}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://navi.training',
          'X-Title': 'Navi Training FAQ Translator',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 8000,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Translation request timed out after 60 seconds');
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Translate FAQs] OpenRouter error:', { status: response.status, errorText });
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[Translate FAQs] Invalid OpenRouter response:', data);
      throw new Error('Invalid response structure from OpenRouter');
    }
    
    const aiResponse = data.choices[0].message.content;

    console.log(`\n[Translate FAQs] GPT Response:`);
    console.log(`Response length: ${aiResponse.length} chars`);
    console.log(`Full response:\n${aiResponse}`);

    // Парсим JSON из ответа
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.error('[Translate FAQs] No JSON found in response!');
      throw new Error('No JSON array found in translation response');
    }

    console.log(`\n[Translate FAQs] Extracted JSON:\n${jsonMatch[0]}`);

    // Парсим JSON с fallback исправлением невалидного JSON
    let translatedFaqs;
    try {
      translatedFaqs = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[Translate FAQs] JSON parse failed, trying to fix...');
      console.error('Parse error:', parseError instanceof Error ? parseError.message : 'Unknown');
      
      let fixedJson = jsonMatch[0];
      
      // ПРОСТОЕ ИСПРАВЛЕНИЕ: Заменяем одинарные кавычки на двойные
      // GPT возвращает: {"question": 'текст'}
      // Нужно: {"question": "текст"}
      
      // Шаг 1: Найти все значения, обрамленные одинарными кавычками
      // Паттерн: ": 'любой текст'
      const singleQuotePattern = /:\s*'([^']*(?:\\'[^']*)*)'/g;
      fixedJson = fixedJson.replace(singleQuotePattern, (_match: string, value: string) => {
        // Заменяем экранированные одинарные кавычки обратно на обычные
        const unescapedValue = value.replace(/\\'/g, "'");
        // Экранируем двойные кавычки
        const escapedValue = unescapedValue.replace(/"/g, '\\"');
        // Возвращаем с двойными кавычками
        return `: "${escapedValue}"`;
      });
      
      console.log('[Translate FAQs] Step 1 - Replaced single quotes');
      console.log('[Translate FAQs] Fixed JSON (first 800 chars):', fixedJson.substring(0, 800));
      
      try {
        translatedFaqs = JSON.parse(fixedJson);
        console.log('[Translate FAQs] ✅ Fixed JSON parsed successfully!');
      } catch (secondError) {
        console.error('[Translate FAQs] ❌ Failed to parse even after fixing');
        console.error('Second error:', secondError instanceof Error ? secondError.message : 'Unknown');
        console.error('Fixed JSON sample:', fixedJson.substring(0, 1000));
        throw new Error(`Invalid JSON in translation response: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`);
      }
    }

    console.log(`\n[Translate FAQs] Parsed array:`);
    console.log(`Array length: ${translatedFaqs.length}`);
    translatedFaqs.forEach((faq: FAQ, i: number) => {
      console.log(`FAQ #${i}: Q="${faq.question.substring(0, 60)}..."`);
    });

    if (!Array.isArray(translatedFaqs) || translatedFaqs.length !== faqs.length) {
      console.error('[Translate FAQs] Length mismatch:', { expected: faqs.length, got: translatedFaqs.length });
      throw new Error(`Invalid translation response: expected ${faqs.length} FAQs, got ${translatedFaqs.length}`);
    }

    // ВАЖНО: добавляем ID обратно к переведенным FAQ для синхронизации
    const translatedFaqsWithIds = translatedFaqs.map((translatedFaq: FAQ, index: number) => ({
      id: faqs[index].id,
      question: translatedFaq.question?.trim() ?? '',
      answer: translatedFaq.answer?.trim() ?? '',
    }));

    console.log('\n[Translate FAQs] IDs preserved:', translatedFaqsWithIds.map(f => f.id));

    validateTranslatedFaqs({ translatedFaqs: translatedFaqsWithIds, originalFaqs: faqs, toLocale });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=== [Translate FAQs] SUCCESS in ${duration}s ===\n`);

    return NextResponse.json({
      success: true,
      translatedFaqs: translatedFaqsWithIds,
    });

  } catch (error) {
    console.error('[Translate FAQs] Error:', error);

    if (error instanceof TranslationValidationError) {
      return NextResponse.json(
        {
          error: 'Translation validation failed',
          details: error.message,
          meta: error.meta,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { 
        error: 'Translation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function validateTranslatedFaqs(params: { translatedFaqs: FAQ[]; originalFaqs: FAQ[]; toLocale: string }) {
  const { translatedFaqs, originalFaqs, toLocale } = params;

  translatedFaqs.forEach((faq, index) => {
    const original = originalFaqs[index];

    if (!faq.question || !faq.answer) {
      throw new TranslationValidationError(
        `FAQ #${index} перевод пустой`,
        {
          index,
          reason: 'empty_text',
          locale: toLocale,
          question: faq.question,
          answer: faq.answer,
        }
      );
    }

    if (original) {
      if (faq.question.trim() === original.question?.trim()) {
        throw new TranslationValidationError(
          `FAQ #${index} вопрос совпадает с оригиналом`,
          {
            index,
            locale: toLocale,
            reason: 'question_equals_original',
            originalQuestion: original.question,
          }
        );
      }

      if (faq.answer.trim() === original.answer?.trim()) {
        throw new TranslationValidationError(
          `FAQ #${index} ответ совпадает с оригиналом`,
          {
            index,
            locale: toLocale,
            reason: 'answer_equals_original',
            originalAnswer: original.answer,
          }
        );
      }
    }

    const questionPercent = calculateCyrillicPercent(faq.question);
    const answerPercent = calculateCyrillicPercent(faq.answer);

    if (toLocale === 'en') {
      if (questionPercent >= 0.1 || answerPercent >= 0.1) {
        throw new TranslationValidationError(
          `FAQ #${index} должен быть на английском, но обнаружена кириллица`,
          {
            index,
            locale: toLocale,
            reason: 'too_much_cyrillic',
            questionPercent,
            answerPercent,
          }
        );
      }
    } else if (toLocale === 'ru' || toLocale === 'uk') {
      if (questionPercent <= 0.3 || answerPercent <= 0.3) {
        throw new TranslationValidationError(
          `FAQ #${index} должен быть на ${toLocale === 'ru' ? 'русском' : 'украинском'}, но найдено слишком мало кириллицы`,
          {
            index,
            locale: toLocale,
            reason: 'not_enough_cyrillic',
            questionPercent,
            answerPercent,
          }
        );
      }
    }

    console.log(
      `[Translate FAQs] FAQ #${index} validated: Q=${(questionPercent * 100).toFixed(1)}% Cyrillic, A=${(answerPercent * 100).toFixed(1)}% Cyrillic ✅`
    );
  });
}

function calculateCyrillicPercent(text: string): number {
  if (!text) {
    return 0;
  }

  const matches = text.match(CYRILLIC_REGEX);
  if (!matches || text.length === 0) {
    return 0;
  }

  return matches.length / text.length;
}
