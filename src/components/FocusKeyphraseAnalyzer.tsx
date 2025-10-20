"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UIFieldClientComponent } from 'payload';
import { Button, useDocumentInfo, useFormFields } from '@payloadcms/ui';

import {
  buildSeoContentContext,
  createContentSignature,
  deriveSeoFieldCandidates,
  resolveFieldValue,
  type FormFieldState,
  type SeoContentContext,
} from '../utils/seoAnalysis';

const contextsSimilar = (a: SeoContentContext | null, b: SeoContentContext | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return a === b;
  return (
    a.name === b.name &&
    a.seoTitle === b.seoTitle &&
    a.metaDescription === b.metaDescription &&
    a.summary === b.summary &&
    a.contentText === b.contentText &&
    a.faqText === b.faqText
  );
};

type InlineFaqEntry = {
  id?: string;
  question?: string;
  answer?: unknown;
  value?: {
    id?: string;
    question?: string;
    answer?: unknown;
  };
};

type FocusKeyphraseStats = {
  inName: boolean;
  inSeoTitle: boolean;
  inMetaDescription: number;
  inSummary: number;
  inContent: number;
  contentPercentage: number;
  inHeadings: number;
  inFaq: number;
  internalLinks: number;  // Новое
  potentialLinks: number; // Новое
  contentSignature: string | null;
  updatedAt: string | null;
};

const EMPTY_STATS: FocusKeyphraseStats = {
  inName: false,
  inSeoTitle: false,
  inMetaDescription: 0,
  inSummary: 0,
  inContent: 0,
  contentPercentage: 0,
  inHeadings: 0,
  inFaq: 0,
  internalLinks: 0,
  potentialLinks: 0,
  contentSignature: null,
  updatedAt: null,
};

type LinkDetails = {
  internalLinks?: {
    collection: string;
    count: number;
    documents?: Array<{
      id: string | number;
      title?: string;
      count: number;
    }>;
  }[];
  potentialLinks?: {
    collection: string;
    count: number;
    documents?: Array<{
      id: string | number;
      title?: string;
      count: number;
    }>;
  }[];
};

export const FocusKeyphraseAnalyzer: UIFieldClientComponent = ({ path }) => {
  const docInfo = useDocumentInfo();
  const [stats, setStats] = useState<FocusKeyphraseStats>(EMPTY_STATS);
  const [isCalculatingLinks, setIsCalculatingLinks] = useState(false);
  const [linkDetails, setLinkDetails] = useState<LinkDetails | null>(null);
  const [showInternalDetails, setShowInternalDetails] = useState(false);
  const [showPotentialDetails, setShowPotentialDetails] = useState(false);
  const [effectiveContext, setEffectiveContext] = useState<SeoContentContext | null>(null);
  const statsRef = useRef<FocusKeyphraseStats>(EMPTY_STATS);
  const lastEnhancedSignatureRef = useRef<string | null>(null);
  const faqCacheRef = useRef<Record<string, unknown[]>>({});

  const formState = useFormFields(([rawFields, dispatch]) => {
    const fields = (rawFields ?? {}) as Record<string, FormFieldState | undefined>;
    const candidates = deriveSeoFieldCandidates(path);

    // Получаем текущую локаль из URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentLocale = urlParams.get('locale') || 'uk';

    // Функция для получения локализованного значения
    const getLocalizedValue = (fieldCandidates: string[] | string | undefined) => {
      if (!fieldCandidates) return undefined;
      
      const candidates = Array.isArray(fieldCandidates) ? fieldCandidates : [fieldCandidates];
      
      // Сначала пробуем с локалью
      for (const candidate of candidates) {
        const localizedKey = `${candidate}.${currentLocale}`;
        const value = resolveFieldValue(fields, localizedKey);
        if (value !== undefined) {
          return value;
        }
      }
      
      // Fallback на обычное поле (если не локализовано)
      return resolveFieldValue(fields, candidates);
    };

    const focusKeyphrase = getLocalizedValue(candidates.focusKeyphrase);
    const statsField = resolveFieldValue(fields, path);
    const name = getLocalizedValue(candidates.name);
    const seoTitle = getLocalizedValue(candidates.seoTitle);
    const metaDescription = getLocalizedValue(candidates.metaDescription);
    const summary = getLocalizedValue(candidates.summary);
    const content = getLocalizedValue(candidates.content);
    const faqs = getLocalizedValue(candidates.faqs);
    const rawAdditional = getLocalizedValue(candidates.additionalFields);
    const slug = getLocalizedValue(['slug']);

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
      focusKeyphrase: (focusKeyphrase as string) ?? '',
      statsField,
      contextParams,
      contextSignature,
      slug: (slug as string) ?? '',
      currentLocale,
      dispatch: typeof dispatch === 'function' ? dispatch : null,
    };
  });

  const { focusKeyphrase, statsField, contextParams, contextSignature, slug, currentLocale, dispatch } = formState;

  const stableContextParams = useMemo(() => contextParams, [contextSignature]);

  const baseContext = useMemo<SeoContentContext | null>(() => {
    if (!stableContextParams) return null;
    return buildSeoContentContext(stableContextParams);
  }, [contextSignature, stableContextParams]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const applyEffectiveContext = useCallback((next: SeoContentContext | null) => {
    setEffectiveContext((prev) => {
      if (contextsSimilar(prev, next)) {
        return prev;
      }
      return next;
    });
  }, []);

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
        const candidate = entry.value && typeof entry.value === 'object' ? entry.value : entry;
        const question = candidate?.question;
        const answer = candidate?.answer;
        const hasQuestion = typeof question === 'string' && question.trim().length > 0;
        const hasAnswer = Boolean(answer);
        if (hasQuestion || hasAnswer) {
          detailed.push({
            question: typeof question === 'string' ? question : '',
            answer,
          });
          continue;
        }
        const idCandidate = entry.id || (typeof (candidate as { id?: string })?.id === 'string' ? (candidate as { id: string }).id : null);
        if (idCandidate) {
          ids.push(idCandidate);
        }
      }
    }

    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    if (uniqueIds.length === 0) {
      console.log('[FocusKeyphraseAnalyzer] resolveFaqDetails: inline entries', detailed.length);
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
            console.log('[FocusKeyphraseAnalyzer] resolveFaqDetails fetched', id, data);
            return {
              question: typeof data.question === 'string' ? data.question : '',
              answer: data.answer ?? null,
            };
          } catch (error) {
            console.error('[FocusKeyphraseAnalyzer] FAQ fetch failed:', error);
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
      console.error('[FocusKeyphraseAnalyzer] FAQ batch fetch failed:', error);
    }

    console.log('[FocusKeyphraseAnalyzer] resolveFaqDetails result length', detailed.length);
    if (detailed.length > 0) {
      faqCacheRef.current[locale] = detailed;
      return detailed;
    }

    if (docInfo?.id) {
      try {
        const response = await fetch(`/api/posts-new/${docInfo.id}?locale=${locale}&depth=2`);
        if (response.ok) {
          const data = await response.json();
          const fromPost = Array.isArray(data?.faqs)
            ? data.faqs
                .map((faq: Record<string, unknown>) => {
                  const question = typeof faq?.question === 'string' ? faq.question : '';
                  const answer = faq?.answer ?? null;
                  if (!question && !answer) return null;
                  return { question, answer };
                })
                .filter(Boolean)
            : [];
          console.log('[FocusKeyphraseAnalyzer] resolveFaqDetails post fallback', fromPost.length);
          if (fromPost.length > 0) {
            faqCacheRef.current[locale] = fromPost as unknown[];
            return fromPost as unknown[];
          }
        } else {
          console.warn('[FocusKeyphraseAnalyzer] resolveFaqDetails post fallback failed with status', response.status);
        }
      } catch (error) {
        console.error('[FocusKeyphraseAnalyzer] resolveFaqDetails post fallback error:', error);
      }
    }

    return null;
  }, []);

  useEffect(() => {
    let active = true;

    const enhanceContext = async () => {
      const signature = contextSignature ?? null;
      const base = baseContext ?? null;

      if (lastEnhancedSignatureRef.current === signature) {
        return;
      }

      if (!signature) {
        applyEffectiveContext(base);
        lastEnhancedSignatureRef.current = signature;
        return;
      }

      if (base && base.faqText && base.faqText.trim().length > 0) {
        applyEffectiveContext(baseContext);
        lastEnhancedSignatureRef.current = signature;
        return;
      }

      const locale = currentLocale ?? 'uk';
      const resolvedFaqs = await resolveFaqDetails(stableContextParams?.faqs, locale);
      if (!active) return;

      if (resolvedFaqs && resolvedFaqs.length > 0) {
        const enhanced = buildSeoContentContext({
          ...stableContextParams,
          faqs: resolvedFaqs,
        });
        applyEffectiveContext(enhanced);
      } else {
        applyEffectiveContext(base);
      }

      lastEnhancedSignatureRef.current = signature;
    };

    void enhanceContext();

    return () => {
      active = false;
    };
  }, [baseContext, contextSignature, currentLocale, resolveFaqDetails, applyEffectiveContext, stableContextParams, effectiveContext]);

  // Загружаем stats из БД (только один раз при монтировании)
  useEffect(() => {
    const loadStats = async () => {
      // Сначала пробуем загрузить из поля формы
      if (statsField && typeof statsField === 'object') {
        setStats({ ...EMPTY_STATS, ...statsField });
        console.log('[FocusKeyphraseAnalyzer] Loaded from form field:', statsField);
        return;
      }

      // Если нет в поле формы, загружаем из БД
      if (docInfo?.id && docInfo?.collectionSlug && currentLocale) {
        try {
          const response = await fetch(
            `/api/seo-stats?entity_type=${docInfo.collectionSlug}&entity_id=${docInfo.id}&locale=${currentLocale}`
          );

          if (response.ok) {
            const data = await response.json();
            if (data && data.stats) {
              setStats({ ...EMPTY_STATS, ...data.stats });
              console.log('[FocusKeyphraseAnalyzer] Loaded from database for locale:', currentLocale, data.stats);
            } else {
              console.log('[FocusKeyphraseAnalyzer] No data for locale:', currentLocale);
            }
          }
        } catch (error) {
          console.error('[FocusKeyphraseAnalyzer] Load error:', error);
        }
      }
    };

    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Пересчет метрик (возвращает новые stats)
  const handleRecalculate = useCallback(async (currentStats: FocusKeyphraseStats): Promise<FocusKeyphraseStats> => {
    let contextForCalc = effectiveContext ?? baseContext;
    if (!focusKeyphrase || !contextForCalc) return currentStats;

    if ((contextForCalc.faqText ?? '').trim().length === 0 && stableContextParams?.faqs) {
      const locale = currentLocale ?? 'uk';
      const resolvedFaqs = await resolveFaqDetails(stableContextParams.faqs, locale);
      if (resolvedFaqs && resolvedFaqs.length > 0) {
        const enhanced = buildSeoContentContext({
          ...stableContextParams,
          faqs: resolvedFaqs,
        });
        applyEffectiveContext(enhanced);
        contextForCalc = enhanced;
      }
    }

    const { computeFocusKeyphraseStats } = await import('../utils/seoAnalysis');

    const baseStats = computeFocusKeyphraseStats({
      focusKeyphrase,
      context: contextForCalc,
      previous: {
        inName: currentStats.inName,
        inSeoTitle: currentStats.inSeoTitle,
        inMetaDescription: currentStats.inMetaDescription,
        inSummary: currentStats.inSummary,
        inContent: currentStats.inContent,
        contentPercentage: currentStats.contentPercentage,
        inHeadings: currentStats.inHeadings,
        inFaq: currentStats.inFaq,
        anchorLinksCount: 0,
        contentSignature: currentStats.contentSignature,
        updatedAt: currentStats.updatedAt,
      },
    });

    console.log('[FocusKeyphraseAnalyzer] FAQ text sample:', (contextForCalc.faqText ?? '').slice(0, 200));
    console.log('[FocusKeyphraseAnalyzer] FAQ occurrences:', baseStats.inFaq);

    const { anchorLinksCount, ...rest } = baseStats;
    void anchorLinksCount;

    const newStats: FocusKeyphraseStats = {
      ...EMPTY_STATS,
      ...rest,
      internalLinks: currentStats.internalLinks,
      potentialLinks: currentStats.potentialLinks,
    };

    return newStats;
  }, [focusKeyphrase, baseContext, effectiveContext, currentLocale, resolveFaqDetails, stableContextParams, applyEffectiveContext]);

  const lastAutoCalcSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusKeyphrase) {
      lastAutoCalcSignatureRef.current = null;
      return;
    }

    const contextForCalc = effectiveContext ?? baseContext;
    if (!contextForCalc) return;

    const signature = createContentSignature([
      focusKeyphrase,
      contextForCalc.name,
      contextForCalc.seoTitle,
      contextForCalc.metaDescription,
      contextForCalc.summary,
      contextForCalc.contentText,
      contextForCalc.faqText,
    ]);

    if (lastAutoCalcSignatureRef.current === signature) return;

    lastAutoCalcSignatureRef.current = signature;

    void (async () => {
      try {
        const updated = await handleRecalculate(statsRef.current);
        const hasChanged =
          updated.inName !== statsRef.current.inName ||
          updated.inSeoTitle !== statsRef.current.inSeoTitle ||
          updated.inMetaDescription !== statsRef.current.inMetaDescription ||
          updated.inSummary !== statsRef.current.inSummary ||
          updated.inContent !== statsRef.current.inContent ||
          Number(updated.contentPercentage.toFixed(2)) !== Number(statsRef.current.contentPercentage.toFixed(2)) ||
          updated.inHeadings !== statsRef.current.inHeadings ||
          updated.inFaq !== statsRef.current.inFaq;

        if (!hasChanged) {
          return;
        }

        setStats(updated);
        statsRef.current = updated;

        if (dispatch) {
          dispatch({ type: 'UPDATE', path, value: updated });
        }
      } catch (error) {
        console.error('[FocusKeyphraseAnalyzer] Auto recalculation failed:', error);
      }
    })();
  }, [focusKeyphrase, baseContext, effectiveContext, handleRecalculate, dispatch, path]);

  // Полный пересчет: метрики + ссылки
  const handleFullRecalculate = useCallback(async () => {
    const contextForCalc = effectiveContext ?? baseContext;
    if (!focusKeyphrase || !contextForCalc) {
      alert('Focus Keyphrase не заполнена');
      return;
    }

    setIsCalculatingLinks(true);

    try {
      // 1. Пересчитываем метрики
      let updatedStats = await handleRecalculate(stats);

      // 2. Подсчитываем ссылки (если документ сохранен)
      if (docInfo?.id && docInfo?.collectionSlug && currentLocale) {
        const response = await fetch('/api/seo-stats/calculate-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_type: docInfo.collectionSlug,
            entity_id: String(docInfo.id),
            language: currentLocale,
            anchors: [focusKeyphrase],
            targetSlug: slug, // Передаем slug для проверки
            includeDetails: true, // Запрашиваем детали
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const result = data.results?.[0];

          if (result) {
            // Обновляем stats со ссылками
            updatedStats = {
              ...updatedStats,
              internalLinks: result.existingLinks || 0,
              potentialLinks: result.potentialLinks || 0,
              updatedAt: new Date().toISOString(),
            };
            
            // Сохраняем детали для раскрывающихся списков
            if (result.details) {
              setLinkDetails({
                internalLinks: result.details.internalLinks || [],
                potentialLinks: result.details.potentialLinks || [],
              });
            }
          }
        }
      }

      // 3. Сохраняем все в state и форму
      setStats(updatedStats);
      
      if (dispatch) {
        dispatch({ type: 'UPDATE', path, value: updatedStats });
      }
      
      // 4. Сохраняем в БД через seo-stats API
      if (docInfo?.id && docInfo?.collectionSlug && currentLocale) {
        try {
          const saveResponse = await fetch('/api/seo-stats', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              entity_type: docInfo.collectionSlug,
              entity_id: String(docInfo.id),
              locale: currentLocale, // ВАЖНО: передаем локаль!
              focus_keyphrase: focusKeyphrase,
              stats: updatedStats,
              calculated_at: new Date().toISOString(),
            }),
          });
          
          if (saveResponse.ok) {
            const savedData = await saveResponse.json();
            console.log('[FocusKeyphraseAnalyzer] Saved to database for locale:', currentLocale, savedData);
          } else {
            const errorText = await saveResponse.text();
            console.error('[FocusKeyphraseAnalyzer] Save failed:', errorText);
          }
        } catch (dbError) {
          console.error('[FocusKeyphraseAnalyzer] Save error:', dbError);
        }
      }
      
      console.log('[FocusKeyphraseAnalyzer] Updated stats:', updatedStats);
    } catch (error) {
      console.error('[FocusKeyphraseAnalyzer] Error:', error);
    } finally {
      setIsCalculatingLinks(false);
    }
  }, [focusKeyphrase, baseContext, effectiveContext, docInfo, handleRecalculate, stats, slug, currentLocale, dispatch, path]);

  if (!focusKeyphrase) {
    return (
      <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '6px', color: '#6b7280', fontSize: '0.875rem' }}>
        Укажите Focus Keyphrase выше для просмотра аналитики
      </div>
    );
  }

  const metrics = [
    {
      label: 'В названии',
      value: stats.inName ? '✓' : '✗',
      color: stats.inName ? '#15803d' : '#b91c1c',
      bg: stats.inName ? 'rgba(34, 197, 94, 0.15)' : 'rgba(248, 113, 113, 0.2)',
    },
    {
      label: 'В SEO Title',
      value: stats.inSeoTitle ? '✓' : '✗',
      color: stats.inSeoTitle ? '#15803d' : '#b91c1c',
      bg: stats.inSeoTitle ? 'rgba(34, 197, 94, 0.15)' : 'rgba(248, 113, 113, 0.2)',
    },
    {
      label: 'В Meta Description',
      value: stats.inMetaDescription,
      color: stats.inMetaDescription > 0 ? '#15803d' : '#b91c1c',
      bg: stats.inMetaDescription > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(248, 113, 113, 0.2)',
    },
    {
      label: 'В Summary',
      value: stats.inSummary,
      color: stats.inSummary > 0 ? '#15803d' : '#b91c1c',
      bg: stats.inSummary > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(248, 113, 113, 0.2)',
    },
    {
      label: 'В Content',
      value: `${stats.inContent} (${stats.contentPercentage.toFixed(2)}%)`,
      color: stats.contentPercentage >= 1 ? '#15803d' : stats.contentPercentage >= 0.4 ? '#b45309' : '#b91c1c',
      bg: stats.contentPercentage >= 1 ? 'rgba(34, 197, 94, 0.15)' : stats.contentPercentage >= 0.4 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(248, 113, 113, 0.2)',
    },
    {
      label: 'В заголовках',
      value: stats.inHeadings,
      color: stats.inHeadings >= 2 ? '#15803d' : stats.inHeadings >= 1 ? '#b45309' : '#b91c1c',
      bg: stats.inHeadings >= 2 ? 'rgba(34, 197, 94, 0.15)' : stats.inHeadings >= 1 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(248, 113, 113, 0.2)',
    },
    {
      label: 'В FAQ',
      value: stats.inFaq,
      color: stats.inFaq >= 2 ? '#15803d' : stats.inFaq >= 1 ? '#b45309' : '#6b7280',
      bg: stats.inFaq >= 2 ? 'rgba(34, 197, 94, 0.15)' : stats.inFaq >= 1 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(156, 163, 175, 0.1)',
    },
    {
      label: 'Внутренние ссылки',
      value: stats.internalLinks,
      color: stats.internalLinks >= 3 ? '#15803d' : '#b91c1c',
      bg: stats.internalLinks >= 3 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(248, 113, 113, 0.2)',
    },
    {
      label: 'Потенциальные ссылки',
      value: stats.potentialLinks,
      color: stats.potentialLinks >= 5 ? '#15803d' : stats.potentialLinks >= 3 ? '#b45309' : '#b91c1c',
      bg: stats.potentialLinks >= 5 ? 'rgba(34, 197, 94, 0.15)' : stats.potentialLinks >= 3 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(248, 113, 113, 0.2)',
    },
  ];

  return (
    <div style={{ 
      border: '2px solid #e5e7eb', 
      borderRadius: '8px', 
      padding: '1.5rem',
      marginBottom: '1.5rem',
      background: '#ffffff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>
            Анализ Focus Keyphrase: &ldquo;{focusKeyphrase}&rdquo;
          </h4>
          {stats.updatedAt && (
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
              Обновлено: {new Date(stats.updatedAt).toLocaleString('ru-RU')}
            </p>
          )}
        </div>
        <Button
          onClick={handleFullRecalculate}
          disabled={isCalculatingLinks}
          buttonStyle="primary"
          size="small"
        >
          {isCalculatingLinks ? 'Анализ...' : 'Пересчитать'}
        </Button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {metrics.map((metric, index) => {
          const isInternalLinks = metric.label === 'Внутренние ссылки';
          const isPotentialLinks = metric.label === 'Потенциальные ссылки';
          const hasDetails = (isInternalLinks || isPotentialLinks) && linkDetails;
          const isExpanded = isInternalLinks ? showInternalDetails : isPotentialLinks ? showPotentialDetails : false;
          
          return (
            <div
              key={index}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: metric.bg,
                borderColor: metric.color + '50',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '0.75rem', cursor: hasDetails ? 'pointer' : 'default' }}
                onClick={() => {
                  if (isInternalLinks && linkDetails) setShowInternalDetails(!showInternalDetails);
                  if (isPotentialLinks && linkDetails) setShowPotentialDetails(!showPotentialDetails);
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {metric.label}
                  {hasDetails && (
                    <span style={{ fontSize: '0.9rem' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: metric.color,
                  }}
                >
                  {metric.value}
                </div>
              </div>
              
              {hasDetails && isExpanded && (
                <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.75rem', background: '#ffffff', maxHeight: '200px', overflowY: 'auto', fontSize: '0.75rem' }}>
                  {isInternalLinks && linkDetails.internalLinks && linkDetails.internalLinks.length > 0 ? (
                    linkDetails.internalLinks.map((coll, idx) => (
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
                    ))
                  ) : isPotentialLinks && linkDetails.potentialLinks && linkDetails.potentialLinks.length > 0 ? (
                    linkDetails.potentialLinks.map((coll, idx) => (
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
                    ))
                  ) : (
                    <div style={{ color: '#9ca3af' }}>Нет данных</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FocusKeyphraseAnalyzer;
