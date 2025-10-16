'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@payloadcms/ui';

type FAQItem = {
  question: string;
  answer: string;
  accepted?: boolean;
};

type AIFaqGeneratorDialogProps = {
  postId: string;
  onClose: () => void;
};

/**
 * Диалог для AI-генерации FAQ
 */
/**
 * Конвертация Lexical JSON в plain text
 */
const lexicalToPlainText = (lexicalJson: any): string => {
  if (!lexicalJson || !lexicalJson.root) return '';
  
  const extractText = (node: any): string => {
    if (!node) return '';
    
    // Если это текстовый узел
    if (node.text) return node.text;
    
    // Если есть дети, рекурсивно извлекаем текст
    if (node.children && Array.isArray(node.children)) {
      return node.children.map(extractText).join(' ');
    }
    
    return '';
  };
  
  return extractText(lexicalJson.root).trim();
};

export const AIFaqGeneratorDialog: React.FC<AIFaqGeneratorDialogProps> = ({ postId, onClose }) => {
  type StepType = 'prompt' | 'generating' | 'preview' | 'saving';
  type SavingProgress = {
    step: string;
    status: 'pending' | 'in_progress' | 'completed' | 'error';
    message?: string;
  };

  const [step, setStep] = useState<StepType>('prompt');
  const [prompt, setPrompt] = useState('Generate FAQ about this article for beginners');
  const [count, setCount] = useState(3);
  const [generatedFaqs, setGeneratedFaqs] = useState<FAQItem[]>([]);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingProgress, setSavingProgress] = useState<SavingProgress[]>([]);

  // Загрузка контекста поста
  const [postData, setPostData] = useState<any>(null);

  useEffect(() => {
    loadPostData();
  }, [postId]);

  /**
   * Загружаем данные поста из Payload
   */
  const loadPostData = async () => {
    try {
      // Получаем текущую локаль из URL
      const urlParams = new URLSearchParams(window.location.search);
      const currentLocale = urlParams.get('locale') || 'uk';

      const response = await fetch(`/api/posts-new/${postId}?locale=${currentLocale}&depth=2`);
      
      if (!response.ok) {
        throw new Error('Failed to load post data');
      }

      const data = await response.json();
      setPostData(data);
    } catch (err) {
      console.error('Failed to load post:', err);
      setError('Не удалось загрузить данные поста');
    }
  };

  /**
   * Генерация FAQ
   */
  const handleGenerate = async () => {
    if (!postData) {
      setError('Данные поста не загружены');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Получаем текущую локаль
      const urlParams = new URLSearchParams(window.location.search);
      const currentLocale = urlParams.get('locale') || 'uk';

      // 1. Получаем suggested questions из DataForSEO
      let suggestedQuestions: string[] = [];
      
      if (postData.seo?.focus_keyphrase) {
        try {
          const dataForSeoResponse = await fetch('/api/dataforseo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'keyword_ideas',
              keyword: postData.seo.focus_keyphrase,
              language_code: currentLocale,
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
      const existingFaqsPlainText = (postData.faqs || []).map((faq: any) => ({
        question: faq.question || '',
        answer: lexicalToPlainText(faq.answer),
      }));

      console.log('[Generate FAQ] Existing FAQs:', existingFaqsPlainText.length);

      // 3. Генерируем FAQ через AI
      const generateResponse = await fetch('/api/generate-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postTitle: postData.name || '',
          postContent: JSON.stringify(postData.content || {}),
          postSummary: postData.summary || '',
          existingFaqs: existingFaqsPlainText,
          focusKeyphrase: postData.seo?.focus_keyphrase || '',
          linkKeywords: postData.seo?.additional_fields?.keywords?.map((k: any) => k.keyword) || [],
          suggestedQuestions,
          userPrompt: prompt,
          count,
          locale: currentLocale,
        }),
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

    const urlParams = new URLSearchParams(window.location.search);
    const currentLocale = urlParams.get('locale') || 'ru';

    // Определяем локали для перевода
    const allLocales = ['ru', 'uk', 'en'];
    const targetLocales = allLocales.filter(l => l !== currentLocale);

    // Инициализируем прогресс
    const progressSteps: SavingProgress[] = [
      { step: 'save_source', status: 'pending', message: `Сохранение FAQ на ${currentLocale === 'ru' ? 'русском' : currentLocale === 'uk' ? 'украинском' : 'английском'} языке` },
    ];

    targetLocales.forEach(locale => {
      progressSteps.push(
        { step: `translate_${locale}`, status: 'pending', message: `Генерация перевода на ${locale === 'ru' ? 'русский' : locale === 'uk' ? 'украинский' : 'английский'} язык` },
        { step: `save_${locale}`, status: 'pending', message: `Сохранение FAQ на ${locale === 'ru' ? 'русском' : locale === 'uk' ? 'украинском' : 'английском'} языке` }
      );
    });

    setSavingProgress(progressSteps);

    try {
      console.log('[Save FAQs] Starting save process...', { currentLocale, targetLocales });

      // Шаг 1: Сохраняем в текущей локали (это создаст пустые копии в других локалях)
      setSavingProgress(prev => prev.map(p => p.step === 'save_source' ? { ...p, status: 'in_progress' } : p));
      
      const saveResponse = await fetch('/api/save-faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          locale: currentLocale,
          faqs: acceptedFaqs.map(faq => ({ question: faq.question, answer: faq.answer })),
          mode: 'add', // Добавляем новые FAQ
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save source FAQs');
      }

      setSavingProgress(prev => prev.map(p => p.step === 'save_source' ? { ...p, status: 'completed' } : p));

      // Получаем ВСЕ FAQ из исходной локали после сохранения
      console.log('[Save FAQs] Fetching all FAQs from', currentLocale);
      const updatedPostResponse = await fetch(`/api/posts-new/${postId}?locale=${currentLocale}&depth=0`);
      if (!updatedPostResponse.ok) {
        throw new Error('Failed to fetch updated post');
      }
      const updatedPost = await updatedPostResponse.json();
      
      // КРИТИЧНО: Фильтруем только ВАЛИДНЫЕ FAQ (с контентом)!
      // Payload создает пустые копии в других локалях (только ID)
      // Если их не отфильтровать, мы будем переводить пустые строки!
      const allFaqs = (updatedPost.faqs || [])
        .filter((faq: any) => {
          const hasQuestion = faq.question && faq.question.trim().length > 0;
          const hasAnswer = faq.answer && 
            typeof faq.answer === 'object' &&
            faq.answer.root && 
            faq.answer.root.children &&
            faq.answer.root.children.length > 0;
          
          if (!hasQuestion || !hasAnswer) {
            console.log(`[Save FAQs] Skipping empty FAQ with ID ${faq.id}`);
            return false;
          }
          return true;
        })
        .map((faq: any) => ({
          id: faq.id, // ВАЖНО: сохраняем ID для синхронизации!
          question: faq.question,
          answer: lexicalToPlainText(faq.answer),
        }));
      
      console.log('[Save FAQs] Valid FAQs to translate:', allFaqs.length);

      // Шаг 2-N: Переводим ВСЕ FAQ и сохраняем в другие локали
      for (const targetLocale of targetLocales) {
        // Переводим ВСЕ FAQ
        setSavingProgress(prev => prev.map(p => p.step === `translate_${targetLocale}` ? { ...p, status: 'in_progress' } : p));
        
        const translatedFaqs = await translateFAQsClient(allFaqs, currentLocale, targetLocale);
        
        setSavingProgress(prev => prev.map(p => p.step === `translate_${targetLocale}` ? { ...p, status: 'completed' } : p));

        // Сохраняем (заменяем все FAQ в целевой локали)
        setSavingProgress(prev => prev.map(p => p.step === `save_${targetLocale}` ? { ...p, status: 'in_progress' } : p));
        
        const saveTranslatedResponse = await fetch('/api/save-faqs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId,
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
            id: faq.id, // КРИТИЧНО: сохраняем ID для синхронизации!
            question: faq.question, 
            answer: faq.answer 
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

      const data = await response.json();
      
      // КРИТИЧНО: Возвращаем переведенные FAQ с сохранением ID!
      // ID нужен для синхронизации одного и того же FAQ между локалями
      return data.translatedFaqs.map((faq: any, index: number) => ({
        id: faqs[index]?.id, // Берем ID из исходного массива
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
                disabled={loading || !postData}
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
