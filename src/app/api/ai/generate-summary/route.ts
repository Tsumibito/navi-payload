import { NextRequest, NextResponse } from 'next/server';

import { authenticatePayloadRequest, unauthorizedResponse } from '@/utils/authenticatedPayload';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_LOCALIZATION_MODEL || 'google/gemini-3.6-flash';

interface GenerateSummaryRequest {
  content: string;
  language: 'ru' | 'ua' | 'uk' | 'en';
  title?: string;
  kind?: 'post' | 'tag';
}

const SYSTEM_PROMPTS = {
  post: {
    ru: 'Ты профессиональный копирайтер. Создай краткое SEO-оптимизированное описание (summary) для статьи о яхтинге. Описание должно быть 2-3 предложения, привлекательным и информативным. Отвечай только текстом описания без дополнительных комментариев.',
    ua: 'Ти професійний копірайтер. Створи короткий SEO-оптимізований опис (summary) для статті про яхтинг. Опис має бути 2-3 речення, привабливим та інформативним. Відповідай лише текстом опису без додаткових коментарів.',
    uk: 'Ти професійний редактор яхтової школи. Створи стислий опис статті українською у 2 реченнях. Використовуй професійну яхтову термінологію, конкретно передай користь матеріалу, без клікбейту й переліку ключових слів. Відповідай лише текстом опису.',
    en: 'You are a professional copywriter. Create a brief SEO-optimized summary for a yachting article. The summary should be 2-3 sentences, engaging and informative. Reply only with the summary text without additional comments.',
  },
  tag: {
    ru: 'Ты профессиональный копирайтер. Создай краткое SEO-оптимизированное описание для тега/категории о яхтинге. Описание должно быть 1-2 предложения, четким и информативным. Отвечай только текстом описания без дополнительных комментариев.',
    ua: 'Ти професійний копірайтер. Створи короткий SEO-оптимізований опис для тегу/категорії про яхтинг. Опис має бути 1-2 речення, чітким та інформативним. Відповідай лише текстом опису без додаткових коментарів.',
    uk: 'Ти професійний редактор яхтової школи. Створи короткий і точний опис категорії українською у 1–2 реченнях. Відповідай лише текстом опису.',
    en: 'You are a professional copywriter. Create a brief SEO-optimized description for a yachting tag/category. The description should be 1-2 sentences, clear and informative. Reply only with the description text without additional comments.',
  },
};

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticatePayloadRequest(request);
    if (!auth) return unauthorizedResponse();

    const body: GenerateSummaryRequest = await request.json();
    const { content, language, title, kind = 'post' } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const token = process.env.OPENROUTER_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'OPENROUTER_TOKEN not configured' },
        { status: 500 }
      );
    }

    // Подготовка промпта
    const systemPrompt = SYSTEM_PROMPTS[kind][language];
    const userPrompt = title
      ? `Заголовок: ${title}\n\nКонтент:\n${content.substring(0, 3000)}`
      : content.substring(0, 3000);

    // Запрос к OpenRouter
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'HTTP-Referer': 'https://navi.training',
        'X-Title': 'Navi Training CMS',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      return NextResponse.json(
        { error: 'No summary generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
