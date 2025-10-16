/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

/**
 * API endpoint для сохранения FAQ
 * 
 * Сохраняет FAQ в указанной локали
 */

type SaveFAQsRequest = {
  postId: string;
  locale: string; // Исходная локаль (en, ru, uk)
  faqs: Array<{ id?: string; question: string; answer: string }>; // id для синхронизации между локалями
  mode?: 'add' | 'replace'; // add = добавить к существующим, replace = заменить все
};

/**
 * POST /api/save-faqs
 */
export async function POST(request: Request) {
  console.log('[Save FAQs] POST request received');
  
  try {
    const body: SaveFAQsRequest = await request.json();
    console.log('[Save FAQs] Request body:', JSON.stringify(body, null, 2));
    
    const { postId, locale, faqs, mode = 'add' } = body;

    if (!postId || !locale || !faqs || faqs.length === 0) {
      console.error('[Save FAQs] Validation failed:', { postId, locale, faqsCount: faqs?.length });
      return NextResponse.json(
        { error: 'Missing required fields: postId, locale, faqs' },
        { status: 400 }
      );
    }

    console.log(`[Save FAQs] Saving ${faqs.length} FAQs for post ${postId} (locale: ${locale})`);

    const payload = await getPayload({ config });

    // Получаем существующий пост
    console.log('[Save FAQs] Fetching post...', { collection: 'posts-new', id: postId, locale });
    
    let post: any;
    try {
      // @ts-ignore - posts-new не в типах
      post = await payload.findByID({
        collection: 'posts-new' as any,
        id: postId,
        locale,
      });
    } catch (findError) {
      console.error('[Save FAQs] Failed to find post:', findError);
      return NextResponse.json(
        { 
          error: 'Post not found', 
          details: `Could not find post with ID ${postId} in locale ${locale}`,
          findError: findError instanceof Error ? findError.message : 'Unknown error',
        },
        { status: 404 }
      );
    }

    console.log('[Save FAQs] Post found:', { id: post.id, name: post.name, mode });

    // Конвертируем answer из string в Lexical JSON
    const newFaqsWithLexical = faqs.map(faq => ({
      question: faq.question,
      answer: stringToLexical(faq.answer),
    }));
    
    let updatedFaqs;
    
    if (mode === 'replace') {
      // Режим REPLACE: обновляем существующие FAQ, сохраняя их ID
      // Это нужно для синхронизации переводов между локалями
      const existingFaqs = post.faqs || [];
      
      console.log('[Save FAQs] REPLACE mode: updating', Math.min(existingFaqs.length, faqs.length), 'FAQs');
      
      if (existingFaqs.length !== faqs.length) {
        console.warn('[Save FAQs] Mismatch! Existing:', existingFaqs.length, 'New:', faqs.length);
      }
      
      // REPLACE режим: обновляем FAQ ПО ID (не по индексу!)
      // Это критически важно для синхронизации переводов между локалями
      
      // Создаем Map существующих FAQ по ID
      const existingFaqsMap = new Map();
      existingFaqs.forEach((faq: any) => {
        if (faq.id) {
          existingFaqsMap.set(faq.id, faq);
        }
      });
      
      console.log('[Save FAQs] Existing FAQ IDs:', Array.from(existingFaqsMap.keys()));
      console.log('[Save FAQs] New FAQ IDs:', faqs.map((f: any) => f.id));
      
      // Обновляем FAQ, сопоставляя по ID
      updatedFaqs = faqs.map((newFaq: any) => {
        if (newFaq.id && existingFaqsMap.has(newFaq.id)) {
          // Нашли FAQ с таким ID - обновляем его
          const existingFaq = existingFaqsMap.get(newFaq.id);
          console.log(`[Save FAQs] Updating FAQ with ID ${newFaq.id}`);
          return {
            ...existingFaq,
            id: existingFaq.id, // Сохраняем ID!
            question: newFaq.question,
            answer: stringToLexical(newFaq.answer),
          };
        } else {
          // FAQ с таким ID нет - добавляем новый
          console.log(`[Save FAQs] Adding new FAQ${newFaq.id ? ` with ID ${newFaq.id}` : ' (ID will be created)'}`);
          return {
            ...(newFaq.id && { id: newFaq.id }), // Если ID есть - используем его
            question: newFaq.question,
            answer: stringToLexical(newFaq.answer),
          };
        }
      });
      
    } else {
      // Режим ADD: добавляем к существующим (с фильтрацией невалидных)
      const existingFaqs = post.faqs || [];
      
      // Фильтруем только валидные существующие FAQ (с question и answer)
      const validExistingFaqs = existingFaqs.filter((faq: any) => {
        const hasQuestion = faq.question && faq.question.trim().length > 0;
        const hasAnswer = faq.answer && 
          faq.answer.root && 
          faq.answer.root.children &&
          faq.answer.root.children.length > 0;
        return hasQuestion && hasAnswer;
      });
      
      console.log('[Save FAQs] ADD mode:', { 
        total: existingFaqs.length, 
        valid: validExistingFaqs.length,
        willAdd: faqs.length,
      });
      
      updatedFaqs = [...validExistingFaqs, ...newFaqsWithLexical];
    }

    // КРИТИЧНО: Удаляем пустые FAQ из updatedFaqs (те, что только с ID)
    // Payload создает пустые записи при синхронизации локалей
    const faqsToSave = updatedFaqs.filter((faq: any) => {
      const hasContent = faq.question && faq.answer;
      if (!hasContent) {
        console.log(`[Save FAQs] Removing empty FAQ with ID ${faq.id}`);
      }
      return hasContent;
    });

    console.log(`[Save FAQs] Saving ${faqsToSave.length} FAQs (removed ${updatedFaqs.length - faqsToSave.length} empty)`);

    // Обновляем пост с новыми FAQ
    await payload.update({
      collection: 'posts-new',
      id: postId,
      data: {
        faqs: faqsToSave,
      },
      locale: locale as 'uk' | 'ru' | 'en',
    });

    console.log(`[Save FAQs] Saved ${faqs.length} FAQs to post ${postId} in ${locale}`);

    return NextResponse.json({
      success: true,
      count: faqs.length,
      locale,
      message: `Сохранено ${faqs.length} FAQ в локали ${locale}`,
    });

  } catch (error) {
    console.error('[Save FAQs] Error:', error);
    console.error('[Save FAQs] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      { 
        error: 'Failed to save FAQs', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Конвертирует строку в Lexical JSON формат
 */
function stringToLexical(text: string) {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text,
              format: 0,
              mode: 'normal',
              style: '',
              detail: 0,
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  };
}

