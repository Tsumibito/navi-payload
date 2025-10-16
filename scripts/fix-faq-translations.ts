/**
 * Скрипт для исправления неправильных переводов FAQ
 * Находит FAQ с кириллицей в английской версии или без кириллицы в UK/RU
 */

import payload from 'payload';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_TOKEN = process.env.OPENROUTER_TOKEN;

type Locale = 'en' | 'ru' | 'uk';

const cyrillicPattern = /[а-яА-ЯёЁіІїЇєЄґҐ]/g;

/**
 * Проверяет валидность перевода
 */
function validateTranslation(text: string, locale: Locale): { valid: boolean; cyrillicPercent: number } {
  const matches = text.match(cyrillicPattern);
  const cyrillicPercent = matches ? matches.length / text.length : 0;
  
  if (locale === 'en') {
    // Английский: кириллицы должно быть < 10%
    return { valid: cyrillicPercent < 0.1, cyrillicPercent };
  } else {
    // Русский/украинский: кириллицы должно быть > 30%
    return { valid: cyrillicPercent > 0.3, cyrillicPercent };
  }
}

/**
 * Конвертирует Lexical в plain text
 */
function lexicalToPlainText(lexicalJson: any): string {
  if (!lexicalJson || !lexicalJson.root) return '';
  
  const extractText = (node: any): string => {
    if (!node) return '';
    if (node.text) return node.text;
    if (node.children && Array.isArray(node.children)) {
      return node.children.map(extractText).join(' ');
    }
    return '';
  };
  
  return extractText(lexicalJson.root).trim();
}

/**
 * Переводит FAQ через OpenRouter
 */
async function translateFAQ(question: string, answer: string, fromLocale: Locale, toLocale: Locale): Promise<{ question: string; answer: string }> {
  const localeNames: Record<Locale, string> = {
    en: 'English',
    ru: 'Russian',
    uk: 'Ukrainian',
  };
  
  const fromLang = localeNames[fromLocale];
  const toLang = localeNames[toLocale];
  
  const systemPrompt = `You are a professional translator. Translate from ${fromLang} to ${toLang}. Be accurate and natural.`;
  const userPrompt = `Translate this FAQ from ${fromLang} to ${toLang}:\n\nQ: ${question}\nA: ${answer}\n\nReturn ONLY a JSON object: {"question": "...", "answer": "..."}`;
  
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_TOKEN}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://navi.training',
      'X-Title': 'Navi Training FAQ Fixer',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`OpenRouter error: ${response.status}`);
  }
  
  const data = await response.json();
  const aiResponse = data.choices[0].message.content;
  
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }
  
  return JSON.parse(jsonMatch[0]);
}

async function fixFAQTranslations() {
  console.log('🔧 Starting FAQ translation fixer...\n');
  
  if (!OPENROUTER_TOKEN) {
    console.error('❌ OPENROUTER_TOKEN not found!');
    process.exit(1);
  }
  
  await payload.init({
    secret: process.env.PAYLOAD_SECRET!,
    local: true,
  });
  
  // Получаем все посты
  const posts = await payload.find({
    collection: 'posts-new',
    limit: 1000,
    locale: 'ru', // Базовая локаль
  });
  
  console.log(`📊 Found ${posts.docs.length} posts\n`);
  
  let totalFixed = 0;
  let totalChecked = 0;
  
  for (const post of posts.docs) {
    if (!post.faqs || post.faqs.length === 0) continue;
    
    console.log(`\n📄 Checking post: "${post.name}" (ID: ${post.id})`);
    
    // Проверяем каждую локаль
    for (const locale of ['en', 'uk'] as Locale[]) {
      const localizedPost = await payload.findByID({
        collection: 'posts-new',
        id: post.id as string,
        locale,
      });
      
      if (!localizedPost.faqs) continue;
      
      for (let idx = 0; idx < localizedPost.faqs.length; idx++) {
        const faq = localizedPost.faqs[idx];
        const question = faq.question || '';
        const answerText = lexicalToPlainText(faq.answer);
        
        totalChecked++;
        
        const qValidation = validateTranslation(question, locale);
        const aValidation = validateTranslation(answerText, locale);
        
        if (!qValidation.valid || !aValidation.valid) {
          console.log(`  ⚠️  FAQ #${idx + 1} in ${locale.toUpperCase()}: Q=${(qValidation.cyrillicPercent * 100).toFixed(0)}% Cyrillic, A=${(aValidation.cyrillicPercent * 100).toFixed(0)}% Cyrillic`);
          console.log(`     Question: "${question.substring(0, 60)}..."`);
          
          // Получаем правильный перевод из RU
          const ruPost = await payload.findByID({
            collection: 'posts-new',
            id: post.id as string,
            locale: 'ru',
          });
          
          if (ruPost.faqs && ruPost.faqs[idx]) {
            const ruFaq = ruPost.faqs[idx];
            const ruQuestion = ruFaq.question || '';
            const ruAnswer = lexicalToPlainText(ruFaq.answer);
            
            console.log(`     🔄 Translating from Russian...`);
            
            try {
              const translated = await translateFAQ(ruQuestion, ruAnswer, 'ru', locale);
              
              // Проверяем что перевод валидный
              const newQValidation = validateTranslation(translated.question, locale);
              const newAValidation = validateTranslation(translated.answer, locale);
              
              if (newQValidation.valid && newAValidation.valid) {
                console.log(`     ✅ Translation validated: Q=${(newQValidation.cyrillicPercent * 100).toFixed(0)}%, A=${(newAValidation.cyrillicPercent * 100).toFixed(0)}%`);
                console.log(`     New question: "${translated.question.substring(0, 60)}..."`);
                
                // TODO: Сохранение исправленного перевода
                // Сейчас просто логируем, чтобы пользователь мог вручную проверить
                totalFixed++;
              } else {
                console.log(`     ❌ Translation still invalid!`);
              }
              
              // Задержка чтобы не превысить rate limit
              await new Promise(resolve => setTimeout(resolve, 1000));
              
            } catch (err) {
              console.error(`     ❌ Translation failed:`, err);
            }
          }
        }
      }
    }
  }
  
  console.log(`\n\n📊 Summary:`);
  console.log(`   Total FAQ checked: ${totalChecked}`);
  console.log(`   Total FAQ fixed: ${totalFixed}`);
  
  process.exit(0);
}

fixFAQTranslations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
