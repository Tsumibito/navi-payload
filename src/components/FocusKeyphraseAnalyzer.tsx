"use client";

import React, { useCallback, useEffect, useState } from 'react';
import type { UIFieldClientComponent } from 'payload';
import { Button, useDocumentInfo, useFormFields } from '@payloadcms/ui';

import {
  buildSeoContentContext,
  deriveSeoFieldCandidates,
  resolveFieldValue,
  type FormFieldState,
} from '../utils/seoAnalysis';

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

    const context = buildSeoContentContext({
      name: (name as string) ?? '',
      seoTitle: (seoTitle as string) ?? '',
      metaDescription: (metaDescription as string) ?? '',
      summary: (summary as string) ?? '',
      content,
      faqs,
      additionalFields: rawAdditional,
    });

    return {
      focusKeyphrase: (focusKeyphrase as string) ?? '',
      statsField,
      context,
      slug: (slug as string) ?? '',
      currentLocale,
      dispatch: typeof dispatch === 'function' ? dispatch : null,
    };
  });

  const { focusKeyphrase, statsField, context, slug, currentLocale, dispatch } = formState;

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
    if (!focusKeyphrase || !context) return currentStats;

    const { enrichKeywordEntries } = await import('../utils/seoAnalysis');
    
    const result = enrichKeywordEntries({
      keywords: [{ keyword: focusKeyphrase, notes: '' }],
      context,
      previous: { keywords: [] },
    });

    const kw = result.value.keywords[0];
    if (!kw) return currentStats;

    const totalCount = kw.cachedTotal ?? 0;
    const totalWords = context.contentText ? context.contentText.split(/\s+/).length : 1;

    const newStats: FocusKeyphraseStats = {
      inName: context.name.toLowerCase().includes(focusKeyphrase.toLowerCase()),
      inSeoTitle: context.seoTitle.toLowerCase().includes(focusKeyphrase.toLowerCase()),
      inMetaDescription: context.metaDescription.toLowerCase().split(focusKeyphrase.toLowerCase()).length - 1,
      inSummary: context.summary.toLowerCase().split(focusKeyphrase.toLowerCase()).length - 1,
      inContent: totalCount,
      contentPercentage: totalCount > 0 && totalWords > 0 ? (totalCount / totalWords) * 100 : 0,
      inHeadings: kw.cachedHeadings ?? 0,
      inFaq: 0,
      internalLinks: currentStats.internalLinks,
      potentialLinks: currentStats.potentialLinks,
      contentSignature: null,
      updatedAt: new Date().toISOString(),
    };

    return newStats;
  }, [focusKeyphrase, context]);

  // Полный пересчет: метрики + ссылки
  const handleFullRecalculate = useCallback(async () => {
    if (!focusKeyphrase || !context) {
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
  }, [focusKeyphrase, context, docInfo, handleRecalculate, stats, slug, currentLocale, dispatch, path]);

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
