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
  collection?: 'posts-new' | 'tags-new';
  locale: string; // Исходная локаль (en, ru, uk)
  faqs: Array<{ id?: string; question: string; answer: string }>; // id для синхронизации между локалями
  mode?: 'add' | 'replace'; // add = добавить к существующим, replace = заменить все
};

type StoredFaqAnswer = {
  root?: {
    children?: unknown[];
  } | null;
} | null;

type StoredFaq = {
  id?: string;
  question?: string | null;
  answer?: StoredFaqAnswer;
};

type DocumentWithFaqs = {
  id: string;
  name?: string | null;
  faqs?: StoredFaq[] | null;
};

type LexicalAnswer = ReturnType<typeof stringToLexical>;

type ProcessedFaq = {
  id?: string;
  question: string;
  answer: LexicalAnswer;
};

/**
 * POST /api/save-faqs
 */
export async function POST(request: Request) {
  console.log('[Save FAQs] POST request received');
  
  try {
    const body: SaveFAQsRequest = await request.json();
    console.log('[Save FAQs] Request body:', JSON.stringify(body, null, 2));
    
    const { postId, collection: rawCollection, locale, faqs, mode = 'add' } = body;

    const collection = rawCollection === 'tags-new' ? 'tags-new' : 'posts-new';

    if (!postId || !locale || !faqs || (mode !== 'replace' && faqs.length === 0)) {
      console.error('[Save FAQs] Validation failed:', { postId, collection, locale, faqsCount: faqs?.length });
      return NextResponse.json(
        { error: 'Missing required fields: postId, locale, faqs' },
        { status: 400 }
      );
    }

    console.log(`[Save FAQs] Saving ${faqs.length} FAQs for ${collection} ${postId} (locale: ${locale})`);

    const payload = await getPayload({ config });

    // Получаем существующий пост
    console.log('[Save FAQs] Fetching document...', { collection, id: postId, locale });

    let document: DocumentWithFaqs;
    try {
      const foundDocument = await (payload.findByID as unknown as <T>(args: { collection: string; id: string; locale: string }) => Promise<T>)({
        collection,
        id: postId,
        locale,
      });
      document = foundDocument as unknown as DocumentWithFaqs;
    } catch (findError) {
      console.error('[Save FAQs] Failed to find document:', findError);
      return NextResponse.json(
        { 
          error: 'Document not found', 
          details: `Could not find ${collection} with ID ${postId} in locale ${locale}`,
          findError: findError instanceof Error ? findError.message : 'Unknown error',
        },
        { status: 404 }
      );
    }

    console.log('[Save FAQs] Document found:', { id: document.id, name: document.name, mode });

    // Конвертируем answer из string в Lexical JSON
    const incomingFaqs: ProcessedFaq[] = faqs.map(faq => ({
      id: faq.id,
      question: faq.question.trim(),
      answer: stringToLexical(faq.answer),
    }));
    
    let updatedFaqs;

    if (mode === 'replace') {
      // Режим REPLACE: обновляем существующие FAQ, сохраняя их ID
      // Это нужно для синхронизации переводов между локалями
      const existingFaqs = Array.isArray(document.faqs)
        ? document.faqs.filter((faq): faq is StoredFaq => Boolean(faq))
        : [];
      
      console.log('[Save FAQs] REPLACE mode: updating', Math.min(existingFaqs.length, faqs.length), 'FAQs');
      
      if (existingFaqs.length !== faqs.length) {
        console.warn('[Save FAQs] Mismatch! Existing:', existingFaqs.length, 'New:', faqs.length);
      }
      
      // REPLACE режим: обновляем FAQ ПО ID (не по индексу!)
      // Это критически важно для синхронизации переводов между локалями
      
      // Создаем Map существующих FAQ по ID
      const existingFaqsMap = new Map<string, StoredFaq>();
      existingFaqs.forEach(faq => {
        if (faq.id) {
          existingFaqsMap.set(faq.id, faq);
        }
      });
      
      console.log('[Save FAQs] Existing FAQ IDs:', Array.from(existingFaqsMap.keys()));
      console.log('[Save FAQs] New FAQ IDs:', incomingFaqs.map(f => f.id));

      // Обновляем FAQ, сопоставляя по ID
      updatedFaqs = incomingFaqs.map(newFaq => {
        if (newFaq.id && existingFaqsMap.has(newFaq.id)) {
          // Нашли FAQ с таким ID - обновляем его
          const existingFaq = existingFaqsMap.get(newFaq.id);
          console.log(`[Save FAQs] Updating FAQ with ID ${newFaq.id}`);
          return {
            id: existingFaq?.id ?? newFaq.id,
            question: newFaq.question,
            answer: newFaq.answer,
          };
        } else {
          // FAQ с таким ID нет - добавляем новый
          console.log(`[Save FAQs] Adding new FAQ${newFaq.id ? ` with ID ${newFaq.id}` : ' (ID will be created)'}`);
          return {
            ...(newFaq.id && { id: newFaq.id }), // Если ID есть - используем его
            question: newFaq.question,
            answer: newFaq.answer,
          };
        }
      });
      
    } else {
      // Режим ADD: добавляем к существующим (с фильтрацией невалидных)
      const existingFaqs = Array.isArray(document.faqs)
        ? document.faqs.filter((faq): faq is StoredFaq => Boolean(faq))
        : [];

      // Фильтруем только валидные существующие FAQ (с question и answer)
      const validExistingFaqs = existingFaqs.filter(faq => {
        const hasQuestion = typeof faq.question === 'string' && faq.question.trim().length > 0;
        const hasAnswer = Boolean(
          faq.answer &&
          faq.answer.root &&
          Array.isArray(faq.answer.root.children) &&
          faq.answer.root.children.length > 0
        );
        return hasQuestion && hasAnswer;
      });

      console.log('[Save FAQs] ADD mode:', { 
        total: existingFaqs.length, 
        valid: validExistingFaqs.length,
        willAdd: faqs.length,
      });

      const sanitizedExistingFaqs: ProcessedFaq[] = validExistingFaqs.map(faq => ({
        id: faq.id,
        question: (faq.question ?? '').trim(),
        answer: (faq.answer ?? stringToLexical('')) as LexicalAnswer,
      }));

      updatedFaqs = [...sanitizedExistingFaqs, ...incomingFaqs];
    }

    // КРИТИЧНО: Удаляем пустые FAQ из updatedFaqs (те, что только с ID)
    // Payload создает пустые записи при синхронизации локалей
    const faqsToSave = updatedFaqs.filter(faq => {
      const questionText = faq.question.trim();
      const hasQuestion = questionText.length > 0;
      const answerRoot = faq.answer?.root;
      const hasAnswer = Boolean(answerRoot && Array.isArray(answerRoot.children) && answerRoot.children.length > 0);
      const hasContent = hasQuestion && hasAnswer;
      if (!hasContent && faq.id) {
        console.log(`[Save FAQs] Removing empty FAQ with ID ${faq.id}`);
      }
      return hasContent;
    });

    console.log(`[Save FAQs] Saving ${faqsToSave.length} FAQs (removed ${updatedFaqs.length - faqsToSave.length} empty)`);

    // Обновляем пост с новыми FAQ
    await payload.update({
      collection,
      id: postId,
      data: {
        faqs: faqsToSave,
      },
      locale: locale as 'uk' | 'ru' | 'en',
    });

    console.log(`[Save FAQs] Saved ${faqs.length} FAQs to ${collection} ${postId} in ${locale}`);

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

