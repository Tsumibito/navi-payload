"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UIFieldClientComponent } from 'payload';
import { Button, useDocumentInfo } from '@payloadcms/ui';
import { useFormFields } from '@payloadcms/ui';

import {
  buildSeoContentContext,
  createContentSignature,
  deriveSeoFieldCandidates,
  enrichKeywordEntries,
  normalizeAdditionalValue,
  serializeKeywords,
  parseAdditionalFields,
  resolveFieldValue,
  type AdditionalFieldsValue,
  type FormFieldState,
  type KeywordEntry,
  type SeoContentContext,
} from '../utils/seoAnalysis';

type InlineFaqEntry = {
  id?: string;
  question?: unknown;
  answer?: unknown;
  value?: {
    id?: string;
    question?: unknown;
    answer?: unknown;
  };
};

const EMPTY_VALUE: AdditionalFieldsValue = { keywords: [] };

export const SeoKeywordManager: UIFieldClientComponent = ({ path }) => {
  const docInfo = useDocumentInfo();
  const resolveLocale = useCallback(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('locale');
      if (fromUrl) {
        return fromUrl;
      }
    }

    return 'ru';
  }, [docInfo]);
  const [localValue, setLocalValue] = useState<AdditionalFieldsValue>(EMPTY_VALUE);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [expandedLinks, setExpandedLinks] = useState<Record<number, boolean>>({});
  const [expandedPotential, setExpandedPotential] = useState<Record<number, boolean>>({});
  const [effectiveContext, setEffectiveContext] = useState<SeoContentContext | null>(null);
  const faqCacheRef = useRef<Record<string, unknown[]>>({});
  const lastContextSignatureRef = useRef<string | null>(null);

  const formState = useFormFields(([rawFields, dispatch]) => {
    const fields = (rawFields ?? {}) as Record<string, FormFieldState | undefined>;
    const candidates = deriveSeoFieldCandidates(path);

    const rawInline = resolveFieldValue(fields, candidates.linkKeywords);
    const stringValue = typeof rawInline === 'string' ? rawInline : '';

    const name = resolveFieldValue(fields, candidates.name);
    const seoTitle = resolveFieldValue(fields, candidates.seoTitle);
    const metaDescription = resolveFieldValue(fields, candidates.metaDescription);
    const summary = resolveFieldValue(fields, candidates.summary);
    const content = resolveFieldValue(fields, candidates.content);
    const faqs = resolveFieldValue(fields, candidates.faqs);
    const focusKeyphrase = resolveFieldValue(fields, candidates.focusKeyphrase);
    const rawAdditional = resolveFieldValue(fields, candidates.additionalFields);
    const slug = resolveFieldValue(fields, ['slug']);

    const contextParams = {
      name: (name as string) ?? '',
      seoTitle: (seoTitle as string) ?? '',
      metaDescription: (metaDescription as string) ?? '',
      summary: (summary as string) ?? '',
      content,
      faqs,
      additionalFields: rawAdditional,
    };

    const contextSignature = createContentSignature([
      contextParams.name,
      contextParams.seoTitle,
      contextParams.metaDescription,
      contextParams.summary,
      contextParams.content ?? null,
      contextParams.faqs ?? null,
      contextParams.additionalFields ?? null,
    ]);

    return {
      stringValue,
      contextParams,
      contextSignature,
      focusKeyphrase: (focusKeyphrase as string) ?? '',
      slug: (slug as string) ?? '',
      dispatch: typeof dispatch === 'function' ? dispatch : null,
    };
  });

  const stringValue = formState?.stringValue ?? '';
  const contextParams = formState?.contextParams;
  const contextSignature = formState?.contextSignature ?? null;
  const dispatch = formState?.dispatch ?? null;
  const focusKeyphrase = formState?.focusKeyphrase ?? '';
  const slug = formState?.slug ?? '';

  const stableContextParams = useMemo(() => contextParams, [contextSignature, contextParams]);

  const baseContext = useMemo<SeoContentContext | null>(() => {
    if (!stableContextParams) return null;
    return buildSeoContentContext(stableContextParams);
  }, [stableContextParams]);

  const resolveFaqDetails = useCallback(async (rawFaqs: unknown, locale: string): Promise<unknown[] | null> => {
    if (faqCacheRef.current[locale]) {
      return faqCacheRef.current[locale] ?? null;
    }

    const entries: InlineFaqEntry[] = Array.isArray(rawFaqs)
      ? (rawFaqs as InlineFaqEntry[])
      : rawFaqs
      ? [rawFaqs as InlineFaqEntry]
      : [];
    const detailed: unknown[] = [];
    const ids: string[] = [];

    for (const entry of entries) {
      if (!entry) continue;
      if (typeof entry === 'string') {
        ids.push(entry);
        continue;
      }
      if (typeof entry === 'object') {
        const record = entry as InlineFaqEntry;
        const candidate = record.value && typeof record.value === 'object' ? record.value : record;
        const question = (candidate as InlineFaqEntry)?.question;
        const answer = (candidate as InlineFaqEntry)?.answer;
        const hasQuestion = typeof question === 'string' && question.trim().length > 0;
        const hasAnswer = Boolean(answer);
        if (hasQuestion || hasAnswer) {
          detailed.push({
            question: typeof question === 'string' ? question : '',
            answer,
          });
          continue;
        }
        const idCandidate = record.id || (typeof (candidate as InlineFaqEntry)?.id === 'string' ? (candidate as InlineFaqEntry).id : null);
        if (idCandidate) {
          ids.push(idCandidate);
        }
      }
    }

    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) {
      if (detailed.length > 0) {
        faqCacheRef.current[locale] = detailed;
        return detailed;
      }
    }

    try {
      const loaded = await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            const response = await fetch(`/api/faqs/${id}?locale=${locale}&depth=0`);
            if (!response.ok) {
              return null;
            }
            const data = await response.json();
            if (!data) {
              return null;
            }
            return {
              question: typeof data.question === 'string' ? data.question : '',
              answer: data.answer ?? null,
            };
          } catch (error) {
            console.error('[SeoKeywordManager] FAQ fetch failed:', error);
            return null;
          }
        })
      );

      for (const item of loaded) {
        if (item) {
          detailed.push(item);
        }
      }
    } catch (error) {
      console.error('[SeoKeywordManager] FAQ batch fetch failed:', error);
    }

    if (detailed.length > 0) {
      faqCacheRef.current[locale] = detailed;
      return detailed;
    }

    if (docInfo?.id) {
      try {
        const response = await fetch(`/api/posts-new/${docInfo.id}?locale=${locale}&depth=2`);
        if (response.ok) {
          const data = await response.json();
          const rawFaqs = Array.isArray(data?.faqs) ? (data.faqs as InlineFaqEntry[]) : [];
          const fromPost = rawFaqs
            .map((faq) => {
              const question = typeof faq?.question === 'string' ? faq.question : '';
              const answer = faq?.answer ?? null;
              if (!question && !answer) return null;
              return { question, answer };
            })
            .filter(Boolean);
          if (fromPost.length > 0) {
            faqCacheRef.current[locale] = fromPost as unknown[];
            return fromPost as unknown[];
          }
        }
      } catch (error) {
        console.error('[SeoKeywordManager] FAQ post fallback error:', error);
      }
    }

    return null;
  }, [docInfo?.id]);

  useEffect(() => {
    const base = baseContext ?? null;
    if (!contextSignature) {
      setEffectiveContext(base);
      lastContextSignatureRef.current = contextSignature ?? null;
      return;
    }

    if (lastContextSignatureRef.current === contextSignature) {
      return;
    }

    let active = true;

    const enhance = async () => {
      if (base && base.faqText && base.faqText.trim().length > 0) {
        if (!active) return;
        setEffectiveContext(base);
        lastContextSignatureRef.current = contextSignature;
        return;
      }

      const locale = resolveLocale();
      const resolved = await resolveFaqDetails(stableContextParams?.faqs, locale);
      if (!active) return;

      if (resolved && resolved.length > 0 && stableContextParams) {
        const enhanced = buildSeoContentContext({
          ...stableContextParams,
          faqs: resolved,
        });
        setEffectiveContext(enhanced);
      } else {
        setEffectiveContext(base);
      }

      lastContextSignatureRef.current = contextSignature;
    };

    void enhance();

    return () => {
      active = false;
    };
  }, [baseContext, contextSignature, resolveFaqDetails, stableContextParams, resolveLocale]);

  const context = effectiveContext ?? baseContext;

  // Загрузка сохраненных данных из БД
  useEffect(() => {
    const loadData = async () => {
      if (!docInfo?.id || !docInfo?.collectionSlug) return;

      try {
        // Получаем текущую локаль из URL
        const currentLocale = resolveLocale();

        const response = await fetch(
          `/api/seo-stats?entity_type=${docInfo.collectionSlug}&entity_id=${docInfo.id}&locale=${currentLocale}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data && data.link_keywords) {
            setLocalValue(data.link_keywords);
            console.log('[SeoKeywordManager] Loaded from database for locale:', currentLocale, data.link_keywords);
          } else {
            console.log('[SeoKeywordManager] No data for locale:', currentLocale);
            setLocalValue(EMPTY_VALUE); // Сбрасываем в пустое значение
          }
        }
      } catch (error) {
        console.error('[SeoKeywordManager] Failed to load data:', error);
      }
    };

    loadData();
  }, [docInfo?.id, docInfo?.collectionSlug, resolveLocale, stringValue]);

  const saveToDatabase = useCallback(
    async (value: AdditionalFieldsValue) => {
      if (!docInfo?.id || !docInfo?.collectionSlug) return;

      try {
        // Получаем текущую локаль из URL
        const currentLocale = resolveLocale();

        const response = await fetch('/api/seo-stats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_type: docInfo.collectionSlug,
            entity_id: String(docInfo.id),
            locale: currentLocale, // ВАЖНО: передаем локаль!
            link_keywords: value,
            calculated_at: new Date().toISOString(),
          }),
        });

        if (response.ok) {
          console.log('[SeoKeywordManager] Data saved to DB for locale:', currentLocale);
        } else {
          console.error('[SeoKeywordManager] Failed to save:', await response.text());
        }
      } catch (error) {
        console.error('[SeoKeywordManager] Save error:', error);
      }
    },
    [docInfo, resolveLocale]
  );

  const commitToForm = useCallback(
    (value: AdditionalFieldsValue) => {
      if (!dispatch) return;

      const candidates = deriveSeoFieldCandidates(path);
      const stringPath = candidates.linkKeywords[0];
      const additionalPath = candidates.additionalFields[0] ?? 'seo.additional_fields';

      if (stringPath) {
        const nextString = serializeKeywords(value.keywords);
        dispatch({ type: 'UPDATE', path: stringPath, value: nextString });
      }

      dispatch({ type: 'UPDATE', path: additionalPath, value });
    },
    [dispatch, path]
  );

  const handleAdd = useCallback(() => {
    setNewKeyword('');
    setIsModalOpen(true);
  }, []);

  const handleSaveKeyword = useCallback(async () => {
    const trimmedKeyword = newKeyword.trim();
    
    if (!trimmedKeyword) {
      alert('Пожалуйста, введите анкор');
      return;
    }

    // Проверка на дубликаты
    const isDuplicate = localValue.keywords.some(
      entry => entry.keyword.toLowerCase() === trimmedKeyword.toLowerCase()
    );
    
    if (isDuplicate) {
      alert('Такой анкор уже добавлен');
      return;
    }

    // Проверка что не совпадает с Focus Keyphrase
    if (focusKeyphrase && trimmedKeyword.toLowerCase() === focusKeyphrase.toLowerCase()) {
      alert('Анкор не должен совпадать с Focus Keyphrase');
      return;
    }

    setIsModalOpen(false);
    setNewKeyword('');
    setIsLoading(true);

    try {
      // Сначала создаем entry с временными значениями
      const newEntry: KeywordEntry = {
        keyword: trimmedKeyword,
        notes: '',
        linksCount: 0,
        potentialLinksCount: 0,
        cachedTotal: 0,
        cachedHeadings: 0,
      };

      // Рассчитываем вхождения в контенте для нового ключа
      if (context) {
        const { value } = enrichKeywordEntries({
          keywords: [newEntry],
          context,
          previous: { keywords: [] },
        });
        
        if (value.keywords[0]) {
          newEntry.cachedTotal = value.keywords[0].cachedTotal;
          newEntry.cachedHeadings = value.keywords[0].cachedHeadings;
        }
      }

      // Подсчитываем ссылки для нового ключа
      if (docInfo?.id && docInfo?.collectionSlug) {
        const currentLocale = resolveLocale();

        const linksResponse = await fetch('/api/seo-stats/calculate-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_type: docInfo.collectionSlug,
            entity_id: String(docInfo.id),
            language: currentLocale,
            anchors: [trimmedKeyword],
            targetSlug: slug, // Передаем slug для проверки
            includeDetails: true, // Запрашиваем детали
          }),
        });

        if (linksResponse.ok) {
          const linksData = await linksResponse.json();
          const linkStats = linksData.results?.[0];
          
          if (linkStats) {
            newEntry.linksCount = linkStats.existingLinks;
            newEntry.potentialLinksCount = linkStats.potentialLinks;
            newEntry.linkDetails = linkStats.details?.internalLinks || [];
            newEntry.potentialDetails = linkStats.details?.potentialLinks || [];
          }
        }
      }

      const newValue: AdditionalFieldsValue = {
        ...localValue,
        keywords: [...localValue.keywords, newEntry],
        statsUpdatedAt: new Date().toISOString(),
      };

      setLocalValue(newValue);
      commitToForm(newValue);
      await saveToDatabase(newValue);
      
      console.log('[SeoKeywordManager] Added and calculated new keyword:', newEntry);
    } catch (error) {
      console.error('[SeoKeywordManager] Add keyword error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [newKeyword, localValue, focusKeyphrase, context, docInfo, slug, commitToForm, saveToDatabase, resolveLocale]);

  const handleRemove = useCallback(
    (index: number) => {
      const newValue: AdditionalFieldsValue = {
        ...localValue,
        keywords: localValue.keywords.filter((_, idx) => idx !== index),
      };

      setLocalValue(newValue);
      commitToForm(newValue);
      saveToDatabase(newValue);
    },
    [localValue, commitToForm, saveToDatabase]
  );

  const handleNotesChange = useCallback(
    (index: number, value: string) => {
      const newKeywords = localValue.keywords.map((entry, idx) => {
        if (idx !== index) return entry;
        return { ...entry, notes: value };
      });

      const newValue: AdditionalFieldsValue = { ...localValue, keywords: newKeywords };
      setLocalValue(newValue);
      commitToForm(newValue);
      saveToDatabase(newValue);
    },
    [localValue, commitToForm, saveToDatabase]
  );

  const handleRecalculate = useCallback(async () => {
    if (!context) return;
    if (localValue.keywords.length === 0) return;
    if (!docInfo?.id || !docInfo?.collectionSlug) return;

    setIsLoading(true);

    try {
      // Сначала пересчитываем вхождения в контенте
      const { value } = enrichKeywordEntries({
        keywords: localValue.keywords,
        context,
        previous: localValue,
      });

      // Фильтруем Focus Keyphrase из Link Keywords (не должна дублироваться)
      const normalizedFocusKeyphrase = focusKeyphrase.toLowerCase().trim();
      if (normalizedFocusKeyphrase) {
        value.keywords = value.keywords.filter(
          entry => entry.keyword.toLowerCase().trim() !== normalizedFocusKeyphrase
        );
        
        if (value.keywords.length < localValue.keywords.length) {
          console.log('[SeoKeywordManager] Removed Focus Keyphrase from Link Keywords:', focusKeyphrase);
        }
      }

      // Затем подсчитываем ссылки по всей БД
      const anchors = value.keywords.map(k => k.keyword).filter(Boolean);
      
      // Получаем locale из URL
      const currentLocale = resolveLocale();

      const linksResponse = await fetch('/api/seo-stats/calculate-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: docInfo.collectionSlug,
          entity_id: String(docInfo.id),
          language: currentLocale,
          anchors,
          targetSlug: slug, // Передаем slug для проверки
          includeDetails: true, // Запрашиваем детали
        }),
      });

      if (linksResponse.ok) {
        const linksData = await linksResponse.json();
        
        // Обновляем keywords с данными о ссылках
        value.keywords = value.keywords.map((keyword, index) => {
          const linkStats = linksData.results?.[index];
          if (linkStats) {
            return {
              ...keyword,
              linksCount: linkStats.existingLinks,
              potentialLinksCount: linkStats.potentialLinks,
              linkDetails: linkStats.details?.internalLinks || [],
              potentialDetails: linkStats.details?.potentialLinks || [],
            };
          }
          return keyword;
        });
      }

      const updatedValue = {
        ...value,
        statsUpdatedAt: new Date().toISOString(),
      };

      setLocalValue(updatedValue);
      commitToForm(updatedValue);
      await saveToDatabase(updatedValue);

      console.log('[SeoKeywordManager] Recalculated and saved:', updatedValue);
    } catch (error) {
      console.error('[SeoKeywordManager] Recalculate error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [context, localValue, commitToForm, saveToDatabase, docInfo, focusKeyphrase, slug, resolveLocale]);

  const keywordRows = useMemo(() => {
    return localValue.keywords.map((entry, index) => {
      const { keyword, notes, linksCount, potentialLinksCount, cachedTotal, cachedHeadings, linkDetails, potentialDetails } = entry;
      const totalValue = cachedTotal ?? 0;
      const headingsValue = cachedHeadings ?? 0;
      const linksValue = linksCount ?? 0;
      const potentialValue = potentialLinksCount ?? 0;

      const totalColor = totalValue >= 5 ? '#15803d' : totalValue >= 3 ? '#b45309' : '#b91c1c';
      const totalBg =
        totalValue >= 5
          ? 'rgba(34, 197, 94, 0.15)'
          : totalValue >= 3
          ? 'rgba(251, 191, 36, 0.2)'
          : 'rgba(248, 113, 113, 0.2)';

      const headingsColor = headingsValue >= 1 ? '#15803d' : '#b45309';
      const headingsBg =
        headingsValue >= 1 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(251, 191, 36, 0.2)';

      const linksColor = linksValue >= 5 ? '#15803d' : linksValue >= 3 ? '#b45309' : '#b91c1c';
      const linksBg =
        linksValue >= 5
          ? 'rgba(34, 197, 94, 0.15)'
          : linksValue >= 3
          ? 'rgba(251, 191, 36, 0.2)'
          : 'rgba(248, 113, 113, 0.2)';

      const potentialColor = potentialValue >= 5 ? '#15803d' : potentialValue >= 3 ? '#b45309' : '#b91c1c';
      const potentialBg =
        potentialValue >= 5
          ? 'rgba(34, 197, 94, 0.15)'
          : potentialValue >= 3
          ? 'rgba(251, 191, 36, 0.2)'
          : 'rgba(248, 113, 113, 0.2)';

      return (
        <div
          key={`${index}-${keyword || 'empty'}`}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1.25rem',
            background: '#f9fafb',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Ключевое слово #{index + 1}
            </div>
            <button
              type="button"
              onClick={() => handleRemove(index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                color: '#dc2626',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Удалить
            </button>
          </div>

          {/* Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Анкор
              </span>
              <div
                style={{
                  width: '100%',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.95rem',
                  background: '#f9fafb',
                  color: '#374151',
                  fontWeight: 500,
                  minHeight: '2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Анкор зафиксирован. Для изменения удалите и создайте новый."
              >
                {keyword || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Не указан</span>}
              </div>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Примечание</span>
              <textarea
                value={notes ?? ''}
                rows={2}
                placeholder="Контекст использования анкора"
                onChange={(e) => handleNotesChange(index, e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.95rem',
                  background: '#fff',
                  resize: 'vertical',
                  minHeight: '2.5rem',
                }}
              />
            </label>

            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: linksBg,
                borderColor: linksColor + '50',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '0.75rem',
                  cursor: linkDetails && linkDetails.length > 0 ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (linkDetails && linkDetails.length > 0) {
                    setExpandedLinks(prev => ({ ...prev, [index]: !prev[index] }));
                  }
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Внутренние ссылки
                  {linkDetails && linkDetails.length > 0 && (
                    <span style={{ fontSize: '0.9rem' }}>
                      {expandedLinks[index] ? '▼' : '▶'}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: linksColor,
                  }}
                >
                  {linksValue}
                </div>
              </div>
              {linkDetails && linkDetails.length > 0 && expandedLinks[index] && (
                <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem', background: '#ffffff', maxHeight: '200px', overflowY: 'auto', fontSize: '0.75rem' }}>
                  {linkDetails.map((coll, idx) => (
                    <div key={idx} style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#374151' }}>{coll.collection}</strong>: {coll.count}
                      {coll.documents && coll.documents.length > 0 && (
                        <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, listStyle: 'none' }}>
                          {coll.documents.map((doc, docIdx) => (
                            <li key={docIdx} style={{ color: '#6b7280' }}>
                              • {doc.title || `ID: ${doc.id}`} ({doc.count})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: potentialBg,
                borderColor: potentialColor + '50',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '0.75rem',
                  cursor: potentialDetails && potentialDetails.length > 0 ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (potentialDetails && potentialDetails.length > 0) {
                    setExpandedPotential(prev => ({ ...prev, [index]: !prev[index] }));
                  }
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Потенциальные ссылки
                  {potentialDetails && potentialDetails.length > 0 && (
                    <span style={{ fontSize: '0.9rem' }}>
                      {expandedPotential[index] ? '▼' : '▶'}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: potentialColor,
                  }}
                >
                  {potentialValue}
                </div>
              </div>
              {potentialDetails && potentialDetails.length > 0 && expandedPotential[index] && (
                <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem', background: '#ffffff', maxHeight: '200px', overflowY: 'auto', fontSize: '0.75rem' }}>
                  {potentialDetails.map((coll, idx) => (
                    <div key={idx} style={{ marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#374151' }}>{coll.collection}</strong>: {coll.count}
                      {coll.documents && coll.documents.length > 0 && (
                        <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, listStyle: 'none' }}>
                          {coll.documents.map((doc, docIdx) => (
                            <li key={docIdx} style={{ color: '#6b7280' }}>
                              • {doc.title || `ID: ${doc.id}`} ({doc.count})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                background: totalBg,
                borderColor: totalColor + '50',
                minWidth: '150px',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Всего вхождений
              </div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: totalColor,
                }}
              >
                {totalValue}
              </div>
            </div>

            <div
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                background: headingsBg,
                borderColor: headingsColor + '50',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                В заголовках
              </div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: headingsColor,
                }}
              >
                {headingsValue}
              </div>
            </div>
          </div>
        </div>
      );
    });
  }, [localValue.keywords, handleNotesChange, handleRemove, expandedLinks, expandedPotential, setExpandedLinks, setExpandedPotential]);

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          gap: '1rem',
        }}
      >
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              margin: '0 0 0.5rem 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Link Keywords
          </h3>
          {localValue.statsUpdatedAt && (
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Последний пересчет:{' '}
              {new Date(localValue.statsUpdatedAt).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <Button
            buttonStyle="secondary"
            size="small"
            onClick={handleRecalculate}
            disabled={localValue.keywords.length === 0 || isLoading}
          >
            {isLoading ? 'Пересчитываю...' : 'Пересчитать'}
          </Button>
          <button
            type="button"
            onClick={handleAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#3b82f6';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Добавить
          </button>
        </div>
      </div>

      {/* List */}
      {localValue.keywords.length === 0 ? (
        <div
          style={{
            border: '1px dashed #d1d5db',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            color: '#6b7280',
          }}
        >
          <p style={{ margin: '0 0 1rem 0' }}>
            Нет ключевых слов. Добавьте анкор для управления внутренними ссылками.
          </p>
          <button
            type="button"
            onClick={handleAdd}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#3b82f6';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Добавить первое слово
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{keywordRows}</div>
      )}

      {/* Модальное окно для добавления анкора */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: 600 }}>
              Добавить ключевое слово
            </h3>
            <p style={{ margin: '0 0 1rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
              Введите анкор для отслеживания внутренних ссылок. Анкор не должен совпадать с Focus Keyphrase.
            </p>
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Например: морская болезнь"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveKeyword();
                } else if (e.key === 'Escape') {
                  setIsModalOpen(false);
                }
              }}
              style={{
                width: '100%',
                border: '2px solid #3b82f6',
                borderRadius: '6px',
                padding: '0.75rem',
                fontSize: '1rem',
                marginBottom: '1.5rem',
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#d1d5db';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#e5e7eb';
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveKeyword}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#3b82f6';
                }}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeoKeywordManager;
