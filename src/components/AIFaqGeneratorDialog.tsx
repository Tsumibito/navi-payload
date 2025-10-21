'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button, useDocumentInfo } from '@payloadcms/ui';

type FAQItem = {
  id?: string;
  question: string;
  answer: string;
  accepted?: boolean;
};

type SupportedCollection = 'posts-new' | 'tags-new';

type AIFaqGeneratorDialogProps = {
  postId: string;
  collectionSlug?: SupportedCollection;
  onClose: () => void;
};

const DEFAULT_PROMPTS: Record<string, string> = {
  ru: 'Создай полезные и понятные новичку в яхтинге FAQ по теме статьи, которые будут реально полезны пользователям и имеют потенциал чтобы попасть в Google подсказки. Умеренно используй в тексте вопросов и ответов ключевые слова поста. Тон дружественно экспертный. Избегай упоминания России, ГИМС и ВФПС, а также компании Интерпарус.',
  uk: 'Створи корисні та зрозумілі новачку в яхтингу FAQ на тему статті, які будуть реально корисні користувачам і мають потенціал потрапити в підказки Google. Помірно використовуй у тексті запитань і відповідей ключові слова поста. Тон дружній та експертний. Уникай згадок про Росію, ГІМС і ВФПС, а також компанію Інтерпарус.',
  en: "Create helpful FAQ about the article's topic that are easy to understand for a beginner in yachting, genuinely useful for users, and have the potential to appear in Google suggestions. Use the post's keywords in the questions and answers sparingly. Keep the tone friendly and expert. Avoid mentioning Russia, GIMS, VFPS, and the company Interparus.",
};

const normalizeLocale = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const lower = value.toLowerCase();

  if (lower.startsWith('ru')) {
    return 'ru';
  }

  if (lower.startsWith('uk') || lower.startsWith('ua')) {
    return 'uk';
  }

  if (lower.startsWith('en')) {
    return 'en';
  }

  return lower;
};

const extractLocaleFromDocInfo = (info: ReturnType<typeof useDocumentInfo>): string | null => {
  if (!info || typeof info !== 'object') {
    return null;
  }

  const maybeLocale = (info as { locale?: unknown }).locale;

  if (typeof maybeLocale === 'string') {
    return maybeLocale;
  }

  if (maybeLocale && typeof maybeLocale === 'object') {
    const localeObj = maybeLocale as { code?: unknown; locale?: unknown };
    if (typeof localeObj.code === 'string') {
      return localeObj.code;
    }
    if (typeof localeObj.locale === 'string') {
      return localeObj.locale;
    }
  }

  const maybeLocaleCode = (info as { localeCode?: unknown }).localeCode;
  if (typeof maybeLocaleCode === 'string') {
    return maybeLocaleCode;
  }

  return null;
};

/**
 * Диалог для AI-генерации FAQ
 */
/**
 * Конвертация Lexical JSON в plain text
 */
type LexicalNode = {
  text?: string;
  children?: LexicalNode[];
};

type LexicalJSON = {
  root?: LexicalNode;
};

const lexicalToPlainText = (lexicalJson?: LexicalJSON | null): string => {
  if (!lexicalJson?.root) {
    return '';
  }

  const extractText = (node?: LexicalNode | null): string => {
    if (!node) {
      return '';
    }

    const parts: string[] = [];

    if (node.text) {
      parts.push(node.text);
    }

    if (node.children && node.children.length > 0) {
      parts.push(node.children.map(extractText).filter(Boolean).join(' '));
    }

    return parts.filter(Boolean).join(' ');
  };

  return extractText(lexicalJson.root).trim();
};

const hasLexicalContent = (answer?: LexicalJSON | null): boolean => {
  const children = answer?.root?.children;
  return Array.isArray(children) && children.length > 0;
};

type PostFaq = {
  id?: string;
  question?: string | null;
  answer?: LexicalJSON | null;
};

type CommonSeo = {
  focus_keyphrase?: string | null;
  additional_fields?: {
    keywords?: Array<{ keyword?: string | null }> | null;
  } | null;
};

type CommonEntity = {
  id?: string;
  name?: string | null;
  summary?: string | null;
  content?: unknown;
  faqs?: PostFaq[] | null;
  seo?: CommonSeo | null;
};

type PostData = CommonEntity & {
  seo?: (CommonSeo & {
    additional_fields?: {
      keywords?: Array<{ keyword?: string | null }> | null;
    } | null;
  }) | null;
};

type TagData = CommonEntity & {
  descriptionForAI?: string | null;
};

type CollectionData = PostData | TagData;

const isTagEntity = (entity: CollectionData): entity is TagData =>
  Object.prototype.hasOwnProperty.call(entity, 'descriptionForAI');

type CollectionContext = {
  collection: SupportedCollection;
  id: string;
};

export const AIFaqGeneratorDialog: React.FC<AIFaqGeneratorDialogProps> = ({ postId, collectionSlug = 'posts-new', onClose }) => {
  type StepType = 'prompt' | 'generating' | 'preview' | 'saving';
  type SavingProgress = {
    step: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error';
    message?: string;
  };

  const [step, setStep] = useState<StepType>('prompt');
  const docInfo = useDocumentInfo();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS.ru);
  const [count, setCount] = useState(3);
  const [generatedFaqs, setGeneratedFaqs] = useState<FAQItem[]>([]);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingProgress, setSavingProgress] = useState<SavingProgress[]>([]);

  // Загрузка контекста поста
  const [entityData, setEntityData] = useState<CollectionData | null>(null);
  const [currentLocale, setCurrentLocale] = useState<string>('ru');

  const resolveLocale = useCallback(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = normalizeLocale(params.get('locale'));
      if (fromUrl) {
        return fromUrl;
      }
    }

    const infoLocale = extractLocaleFromDocInfo(docInfo);
    if (infoLocale) {
      const normalized = normalizeLocale(infoLocale);
      if (normalized) {
        return normalized;
      }
    }

    return 'ru';
  }, [docInfo]);

  useEffect(() => {
    const locale = resolveLocale();
    setCurrentLocale(locale);
  }, [resolveLocale]);

  useEffect(() => {
    const defaultPrompt = DEFAULT_PROMPTS[currentLocale] || DEFAULT_PROMPTS.ru;
    setPrompt(defaultPrompt);
  }, [currentLocale]);

  const resolveCollection = useCallback((): CollectionContext => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const collectionFromUrl = params.get('collection');
      if (collectionFromUrl === 'posts-new' || collectionFromUrl === 'tags-new') {
        return { collection: collectionFromUrl, id: postId };
      }

      const match = window.location.pathname.match(/\/collections\/(posts-new|tags-new)\//);
      if (match) {
        return { collection: match[1] as SupportedCollection, id: postId };
      }
    }

    if (docInfo && typeof docInfo === 'object') {
      const maybeCollection = (docInfo as { collection?: unknown }).collection;
      if (maybeCollection === 'posts-new' || maybeCollection === 'tags-new') {
        return { collection: maybeCollection, id: postId };
      }
    }

    return {
      collection: collectionSlug,
      id: postId,
    };
  }, [collectionSlug, docInfo, postId]);

  const getFetchPath = useCallback((context: CollectionContext, locale: string) => {
    const params = new URLSearchParams({ locale, depth: '2', draft: 'true' });
    return `/api/${context.collection}/${context.id}?${params.toString()}`;
  }, []);

  const loadEntityData = useCallback(async () => {
    try {
      const locale = resolveLocale();
      setCurrentLocale(locale);

      const context = resolveCollection();
      const fetchPath = getFetchPath(context, locale);
      const response = await fetch(fetchPath, { credentials: 'include' });
      
      if (!response.ok) {
        throw new Error('Failed to load entity data');
      }

      const data: CollectionData = await response.json();
      setEntityData(data);
    } catch (err) {
      console.error('Failed to load entity:', err);
      setError('Не удалось загрузить данные записи');
    }
  }, [getFetchPath, resolveCollection, resolveLocale]);

  useEffect(() => {
    loadEntityData();
  }, [loadEntityData]);

  /**
   * Загружаем данные поста из Payload
   */
  /**
   * Генерация FAQ
   */
  const handleGenerate = async () => {
    if (!entityData) {
      setError('Данные записи не загружены');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const locale = resolveLocale();
      setCurrentLocale(locale);

      const collectionContext = resolveCollection();
      const { collection } = collectionContext;

      // 1. Получаем suggested questions из DataForSEO
      let suggestedQuestions: string[] = [];
      
      if (entityData.seo?.focus_keyphrase) {
        try {
          const dataForSeoResponse = await fetch('/api/dataforseo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'keyword_ideas',
              keyword: entityData.seo.focus_keyphrase,
              language_code: locale,
            }),
          });

          if (dataForSeoResponse.ok) {
            const dataForSeoData = await dataForSeoResponse.json();
            suggestedQuestions = dataForSeoData.questions || [];
          }
        } catch (err) {
          console.warn('DataForSEO failed, continuing without suggestions:', err);
        }
      }

      // 2. Конвертируем существующие FAQ из Lexical в plain text
      const existingFaqsPlainText = (entityData.faqs ?? []).map((faq: PostFaq | null | undefined) => ({
        question: faq?.question ?? '',
        answer: lexicalToPlainText(faq?.answer),
      }));

      console.log('[Generate FAQ] Existing FAQs:', existingFaqsPlainText.length);
      console.log('[Generate FAQ] Focus Keyphrase:', entityData.seo?.focus_keyphrase);
      console.log('[Generate FAQ] Link Keywords structure:', entityData.seo?.additional_fields);
      
      const linkKeywords =
        entityData.seo?.additional_fields?.keywords
          ?.map((keywordEntry: { keyword?: string | null } | null | undefined): string | null =>
            keywordEntry?.keyword ? keywordEntry.keyword : null
          )
          .filter((keyword): keyword is string => Boolean(keyword && keyword.trim())) ?? [];
      console.log('[Generate FAQ] Link Keywords:', linkKeywords);

      const descriptionForAI = isTagEntity(entityData) ? entityData.descriptionForAI ?? '' : '';

      const generatePayload = {
        postTitle: entityData.name || '',
        postContent: JSON.stringify(entityData.content || {}),
        postSummary: entityData.summary || '',
        existingFaqs: existingFaqsPlainText,
        focusKeyphrase: entityData.seo?.focus_keyphrase || '',
        linkKeywords,
        suggestedQuestions,
        userPrompt: prompt,
        count,
        locale,
        collection,
        descriptionForAI,
      };

      console.log('[Generate FAQ] Payload collection:', generatePayload.collection);

      // 3. Генерируем FAQ через AI
      const generateResponse = await fetch('/api/generate-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatePayload),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.error || 'Failed to generate FAQs');
      }

      const result = await generateResponse.json();
      
      setGeneratedFaqs(result.faqs.map((faq: FAQItem) => ({ ...faq, accepted: true })));
      setStep('preview');

    } catch (err) {
      console.error('Generate error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка генерации FAQ');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Regenerate с feedback
   */
  const handleRegenerate = async () => {
    if (!feedback.trim()) {
      setError('Введите замечания для улучшения');
      return;
    }

    const enhancedPrompt = `${prompt}\n\nПредыдущие варианты были неудачны. Улучшения: ${feedback}`;
    
    // Временно обновляем промпт
    const originalPrompt = prompt;
    setPrompt(enhancedPrompt);
    
    await handleGenerate();
    
    // Возвращаем оригинальный промпт
    setPrompt(originalPrompt);
    setFeedback('');
  };

  /**
   * Сохранение FAQ с интерактивным прогрессом
   */
  const handleSave = async () => {
    const acceptedFaqs = generatedFaqs.filter(faq => faq.accepted);
    
    if (acceptedFaqs.length === 0) {
      setError('Нужно принять хотя бы один FAQ');
      return;
    }

    setStep('saving');
    setLoading(true);
    setError(null);

    const locale = resolveLocale();
    setCurrentLocale(locale);

    // Определяем локали для перевода
    const allLocales = ['ru', 'uk', 'en'];
    const targetLocales = allLocales.filter(l => l !== locale);

    // Инициализируем прогресс
    const progressSteps: SavingProgress[] = [
      { step: 'save_source', status: 'pending', message: `Сохранение FAQ на ${locale === 'ru' ? 'русском' : locale === 'uk' ? 'украинском' : 'английском'} языке` },
    ];

    targetLocales.forEach(locale => {
      progressSteps.push(
        { step: `translate_${locale}`, status: 'pending', message: `Генерация перевода на ${locale === 'ru' ? 'русский' : locale === 'uk' ? 'украинский' : 'английский'} язык` },
        { step: `save_${locale}`, status: 'pending', message: `Сохранение FAQ на ${locale === 'ru' ? 'русском' : locale === 'uk' ? 'украинском' : 'английском'} языке` }
      );
    });

    setSavingProgress(progressSteps);

    try {
      console.log('[Save FAQs] Starting save process...', { currentLocale: locale, targetLocales });

      // Шаг 1: Сохраняем в текущей локали (это создаст пустые копии в других локалях)
      setSavingProgress(prev => prev.map(p => p.step === 'save_source' ? { ...p, status: 'in_progress' } : p));
      
      const collectionContext = resolveCollection();
      const { collection } = collectionContext;

      const saveResponse = await fetch('/api/save-faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          collection,
          locale,
          faqs: acceptedFaqs.map(faq => ({ question: faq.question, answer: faq.answer })),
          mode: 'add', // Добавляем новые FAQ
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save source FAQs');
      }

      setSavingProgress(prev => prev.map(p => p.step === 'save_source' ? { ...p, status: 'completed' } : p));

      // Получаем ВСЕ FAQ из исходной локали после сохранения
      console.log('[Save FAQs] Fetching all FAQs from', locale);
      const updatedEntityResponse = await fetch(getFetchPath(collectionContext, locale));
      if (!updatedEntityResponse.ok) {
        throw new Error('Failed to fetch updated entity');
      }
      const updatedEntity: CollectionData = await updatedEntityResponse.json();

      // КРИТИЧНО: Фильтруем только ВАЛИДНЫЕ FAQ (с контентом)!
      // Payload создает пустые копии в других локалях (только ID)
      // Если их не отфильтровать, мы будем переводить пустые строки!
      const allFaqs: FAQItem[] = (updatedEntity.faqs ?? [])
        .filter((faq: PostFaq | null | undefined): faq is PostFaq => {
          if (!faq) {
            return false;
          }

          const hasQuestion = typeof faq.question === 'string' && faq.question.trim().length > 0;
          const hasAnswer = hasLexicalContent(faq.answer);
          
          if (!hasQuestion || !hasAnswer) {
            if (faq.id) {
              console.log(`[Save FAQs] Skipping empty FAQ with ID ${faq.id}`);
            }
            return false;
          }
          return true;
        })
        .map(faq => ({
          id: faq.id,
          question: faq.question?.trim() ?? '',
          answer: lexicalToPlainText(faq.answer),
        }));
      
      console.log('[Save FAQs] Valid FAQs to translate:', allFaqs.length);

      // Шаг 2-N: Переводим ВСЕ FAQ и сохраняем в другие локали
      for (const targetLocale of targetLocales) {
        // Переводим ВСЕ FAQ
        setSavingProgress(prev => prev.map(p => p.step === `translate_${targetLocale}` ? { ...p, status: 'in_progress' } : p));
        
        const translatedFaqs = await translateFAQsClient(allFaqs, locale, targetLocale);
        
        setSavingProgress(prev => prev.map(p => p.step === `translate_${targetLocale}` ? { ...p, status: 'completed' } : p));

        // Сохраняем (заменяем все FAQ в целевой локали)
        setSavingProgress(prev => prev.map(p => p.step === `save_${targetLocale}` ? { ...p, status: 'in_progress' } : p));
        
        const saveTranslatedResponse = await fetch('/api/save-faqs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId,
            collection,
            locale: targetLocale,
            faqs: translatedFaqs,
            mode: 'replace', // ЗАМЕНЯЕМ все FAQ (не добавляем)
          }),
        });

        if (!saveTranslatedResponse.ok) {
          const errorText = await saveTranslatedResponse.text();
          console.error(`[Save FAQs] Failed to save ${targetLocale}:`, errorText);
          throw new Error(`Failed to save ${targetLocale} FAQs: ${errorText}`);
        }

        setSavingProgress(prev => prev.map(p => p.step === `save_${targetLocale}` ? { ...p, status: 'completed' } : p));
      }

      console.log('[Save FAQs] All steps completed!');

      // Ждем 1 секунду чтобы пользователь увидел финальный статус
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error('[Save FAQs] Error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка сохранения FAQ');
      setSavingProgress(prev => prev.map(p => p.status === 'in_progress' ? { ...p, status: 'error' } : p));
      setLoading(false);
    }
  };

  /**
   * Перевод FAQ на клиенте
   */
  const translateFAQsClient = async (
    faqs: FAQItem[],
    fromLocale: string,
    toLocale: string
  ): Promise<Array<{ id?: string; question: string; answer: string }>> => {
    try {
      const response = await fetch('/api/translate-faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faqs: faqs.map(faq => ({
            id: faq.id,
            question: faq.question,
            answer: faq.answer,
          })),
          fromLocale,
          toLocale,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Translate FAQs Client] Error:', errorData);
        
        // Детальное сообщение об ошибке перевода
        let errorMsg = 'Translation failed';
        if (errorData.details) {
          errorMsg = `Ошибка перевода: ${errorData.details}`;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        }
        
        throw new Error(errorMsg);
      }

      type TranslateFaqsResponse = {
        translatedFaqs: Array<{ question: string; answer: string }>;
      };

      const data: TranslateFaqsResponse = await response.json();
      
      // КРИТИЧНО: Возвращаем переведенные FAQ с сохранением ID!
      // ID нужен для синхронизации одного и того же FAQ между локалями
      return data.translatedFaqs.map((faq, index) => ({
        id: faqs[index]?.id,
        question: faq.question,
        answer: faq.answer,
      }));
      
    } catch (error) {
      // Проверяем если это ошибка сети (сервер упал)
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('[Translate FAQs Client] Server is unavailable or crashed');
        throw new Error('Сервер недоступен. Возможно он упал во время перевода. Попробуйте перезапустить dev-сервер и повторить.');
      }
      throw error;
    }
  };

  /**
   * Toggle accept/reject FAQ
   */
  const toggleAccept = (index: number) => {
    setGeneratedFaqs(prev => 
      prev.map((faq, i) => 
        i === index ? { ...faq, accepted: !faq.accepted } : faq
      )
    );
  };

  /**
   * Edit FAQ
   */
  const editFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setGeneratedFaqs(prev =>
      prev.map((faq, i) =>
        i === index ? { ...faq, [field]: value } : faq
      )
    );
  };

  console.log('[AIFaqGeneratorDialog] Rendering, postId:', postId, 'step:', step);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div 
        style={{ 
          background: 'white', 
          padding: '2rem', 
          minWidth: '600px', 
          maxWidth: '800px',
          borderRadius: '8px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🤖 AI FAQ Generator
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
            }}
          >
            ✕
          </button>
        </h2>

        {error && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c00',
          }}>
            ❌ {error}
          </div>
        )}

        {/* Step 1: Prompt */}
        {step === 'prompt' && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                📝 Prompt:
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
                placeholder="Generate FAQ about yacht licensing for beginners..."
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Count:
              </label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                style={{
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              >
                <option value={1}>1 FAQ</option>
                <option value={2}>2 FAQ</option>
                <option value={3}>3 FAQ</option>
                <option value={4}>4 FAQ</option>
                <option value={5}>5 FAQ</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button onClick={onClose} buttonStyle="secondary">
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                buttonStyle="primary"
                disabled={loading || !entityData}
              >
                {loading ? 'Генерация...' : '🚀 Generate FAQs'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>📊 Preview ({generatedFaqs.filter(f => f.accepted).length}/{generatedFaqs.length} принято):</h3>

            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem' }}>
              {generatedFaqs.map((faq, index) => (
                <div
                  key={index}
                  style={{
                    padding: '1rem',
                    marginBottom: '1rem',
                    border: `2px solid ${faq.accepted ? '#4CAF50' : '#ccc'}`,
                    borderRadius: '8px',
                    background: faq.accepted ? '#f0fff0' : '#f9f9f9',
                  }}
                >
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong>Q:</strong>
                    <input
                      type="text"
                      value={faq.question}
                      onChange={(e) => editFaq(index, 'question', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        marginTop: '0.25rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong>A:</strong>
                    <textarea
                      value={faq.answer}
                      onChange={(e) => editFaq(index, 'answer', e.target.value)}
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        marginTop: '0.25rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => toggleAccept(index)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: faq.accepted ? '#4CAF50' : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {faq.accepted ? '✓ Accepted' : '✗ Rejected'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                💬 Замечания для улучшения (опционально):
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
                placeholder="Make answers shorter, add more examples..."
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
              <Button
                onClick={handleRegenerate}
                buttonStyle="secondary"
                disabled={loading}
              >
                🔄 Regenerate
              </Button>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <Button onClick={() => setStep('prompt')} buttonStyle="secondary">
                  ← Back
                </Button>
                <Button
                  onClick={handleSave}
                  buttonStyle="primary"
                  disabled={loading || generatedFaqs.filter(f => f.accepted).length === 0}
                >
                  ✅ Save All FAQs
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Saving with Progress */}
        {step === 'saving' && (
          <div style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>💾 Сохранение FAQ</h3>
            
            {/* Предупреждение */}
            <div style={{
              background: '#fff3e0',
              border: '2px solid #ff9800',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠️</div>
              <div style={{ fontSize: '0.875rem' }}>
                <strong>Не закрывайте это окно!</strong> Процесс сохранения и перевода займёт некоторое время.
                Если закрыть окно сейчас, процесс прервётся и FAQ не будут сохранены во все локали.
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {savingProgress
                .filter((progress, idx) => {
                  // Показываем только выполненные, текущий и следующий
                  const currentIdx = savingProgress.findIndex(p => p.status === 'in_progress');
                  if (currentIdx === -1) {
                    // Все завершены - показываем все
                    return true;
                  }
                  // Показываем до текущего + текущий
                  return idx <= currentIdx;
                })
                .map((progress, idx) => (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: progress.status === 'completed' ? '#e8f5e9' : 
                                 progress.status === 'in_progress' ? '#fff3e0' : 
                                 progress.status === 'error' ? '#ffebee' : '#f5f5f5',
                      borderRadius: '8px',
                      border: `2px solid ${
                        progress.status === 'completed' ? '#4caf50' : 
                        progress.status === 'in_progress' ? '#ff9800' : 
                        progress.status === 'error' ? '#f44336' : '#e0e0e0'
                      }`,
                      animation: progress.status === 'in_progress' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>
                      {progress.status === 'completed' && '✅'}
                      {progress.status === 'in_progress' && '⏳'}
                      {progress.status === 'error' && '❌'}
                      {progress.status === 'pending' && '⏸️'}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold' }}>{progress.message}</div>
                      {progress.status === 'in_progress' && (
                        <div style={{ 
                          fontSize: '0.875rem', 
                          color: '#666', 
                          marginTop: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}>
                          <span>В процессе</span>
                          <span style={{ 
                            animation: 'dots 1.5s steps(4, end) infinite',
                            display: 'inline-block',
                            width: '1em',
                          }}>...</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {error && (
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1rem', 
                background: '#ffebee', 
                borderRadius: '8px',
                color: '#c62828',
              }}>
                <strong>Ошибка:</strong> {error}
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                  Попробуйте закрыть окно и повторить попытку.
                </div>
              </div>
            )}
            
            <style>
              {`
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.7; }
                }
                @keyframes dots {
                  0%, 20% { content: '.'; }
                  40% { content: '..'; }
                  60%, 100% { content: '...'; }
                }
              `}
            </style>
          </div>
        )}
      </div>
    </div>
  );
};
