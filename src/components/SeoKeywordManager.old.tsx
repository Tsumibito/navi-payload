"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UIFieldClientComponent } from 'payload';
import { useFormFields } from '@payloadcms/ui';

import {
  buildSeoContentContext,
  createContentSignature,
  deepEqual,
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

type ManagerFormState = {
  additionalPath: string | null;
  stringPath: string | null;
  additionalValue: AdditionalFieldsValue;
  additionalSignature: string;
  stringValue: string;
  stringSignature: string;
  context: SeoContentContext | null;
  contextSignature: string;
  dispatch: ((action: { type: 'UPDATE'; path: string; value: unknown }) => void) | null;
};

const EMPTY_VALUE: AdditionalFieldsValue = { keywords: [] };

const LINKS_HINT = 'Укажите количество внутренних ссылок, которые должны использовать этот анкор.';

export const SeoKeywordManager: UIFieldClientComponent = ({ path }) => {
  const formState = useFormFields(([rawFields, dispatch]) => {
    const fields = (rawFields ?? {}) as Record<string, FormFieldState | undefined>;
    const candidates = deriveSeoFieldCandidates(path);

    const rawAdditional = resolveFieldValue(fields, candidates.additionalFields);
    const rawInline = resolveFieldValue(fields, candidates.linkKeywords);
    const additionalValue = parseAdditionalFields(rawAdditional);
    const stringValue = typeof rawInline === 'string' ? rawInline : '';
    const additionalSignature = JSON.stringify(additionalValue);
    const stringSignature = stringValue;

    const name = resolveFieldValue(fields, candidates.name);
    const seoTitle = resolveFieldValue(fields, candidates.seoTitle);
    const metaDescription = resolveFieldValue(fields, candidates.metaDescription);
    const summary = resolveFieldValue(fields, candidates.summary);
    const content = resolveFieldValue(fields, candidates.content);
    const faqs = resolveFieldValue(fields, candidates.faqs);

    const context = buildSeoContentContext({
      name: (name as string) ?? '',
      seoTitle: (seoTitle as string) ?? '',
      metaDescription: (metaDescription as string) ?? '',
      summary: (summary as string) ?? '',
      content,
      faqs,
      additionalFields: rawAdditional,
    });

    const contextSignature = createContentSignature([
      context.name,
      context.seoTitle,
      context.metaDescription,
      context.summary,
      context.contentText,
      context.headingsText,
      context.faqText,
    ]);

    const additionalPath =
      candidates.additionalFields[0] ??
      (path ? path.replace(/additional_fields.*/, '') + 'additional_fields' : 'seo.additional_fields');

    const stringPath = candidates.linkKeywords[0] ?? null;

    return {
      additionalPath,
      stringPath,
      additionalValue,
      additionalSignature,
      stringValue,
      stringSignature,
      context,
      contextSignature,
      dispatch: typeof dispatch === 'function' ? dispatch : null,
    } satisfies ManagerFormState;
  });

  const additionalPath = formState?.additionalPath ?? null;
  const stringPath = formState?.stringPath ?? null;
  const externalValue = formState?.additionalValue ?? EMPTY_VALUE;
  const additionalSignature = formState?.additionalSignature ?? 'null';
  const stringValue = formState?.stringValue ?? '';
  const stringSignature = formState?.stringSignature ?? '';
  const context = formState?.context ?? null;
  const contextSignature = formState?.contextSignature ?? 'null';
  const dispatch = formState?.dispatch ?? null;

  const externalNormalized = useMemo(
    () => normalizeAdditionalValue(externalValue, stringValue),
    [additionalSignature, stringSignature],
  );
  const externalString = useMemo(() => serializeKeywords(externalNormalized.keywords), [externalNormalized]);
  const stringFieldValue = stringValue;

  const [localValue, setLocalValue] = useState<AdditionalFieldsValue>(externalNormalized);
  const [pendingCommit, setPendingCommit] = useState<{ value: AdditionalFieldsValue; string: string } | null>(null);

  const contextRef = useRef(context);
  const dispatchRef = useRef(dispatch);
  const pathRef = useRef(additionalPath);
  const stringPathRef = useRef(stringPath);
  const stringValueRef = useRef(stringFieldValue);
  const externalNormalizedRef = useRef(externalNormalized);
  const externalStringRef = useRef(externalString);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    pathRef.current = additionalPath;
  }, [additionalPath]);

  useEffect(() => {
    stringPathRef.current = stringPath;
  }, [stringPath]);

  useEffect(() => {
    stringValueRef.current = stringFieldValue;
  }, [stringFieldValue]);

  useEffect(() => {
    externalNormalizedRef.current = externalNormalized;
    externalStringRef.current = externalString;
  }, [externalNormalized, externalString]);

  // Синхронизация с внешним состоянием (только если нет отложенного коммита)
  useEffect(() => {
    if (pendingCommit) return;
    const currentExternal = externalNormalizedRef.current;
    if (!deepEqual(localValue, currentExternal)) {
      setLocalValue(currentExternal);
    }
  }, [additionalSignature, stringSignature, pendingCommit, localValue]);

  const commitAdditional = useCallback((value: AdditionalFieldsValue) => {
    const currentDispatch = dispatchRef.current;
    const currentPath = pathRef.current;
    if (currentDispatch && currentPath) {
      currentDispatch({ type: 'UPDATE', path: currentPath, value });
    }
  }, []);

  const commitString = useCallback((nextString: string) => {
    const currentStringPath = stringPathRef.current;
    const currentDispatch = dispatchRef.current;
    if (currentStringPath && currentDispatch) {
      if (stringValueRef.current !== nextString) {
        currentDispatch({ type: 'UPDATE', path: currentStringPath, value: nextString });
      }
    }
  }, []);

  // Коммит отложенных изменений в форму (асинхронно)
  useEffect(() => {
    if (!pendingCommit) return;
    
    const { value, string } = pendingCommit;
    commitAdditional(value);
    commitString(string);
    setPendingCommit(null);
  }, [pendingCommit, commitAdditional, commitString]);

  const applyKeywords = useCallback((producer: (prev: AdditionalFieldsValue) => KeywordEntry[]) => {
    setLocalValue((prev) => {
      const nextKeywords = producer(prev);
      const currentContext = contextRef.current;
      let nextValue: AdditionalFieldsValue;

      if (currentContext) {
        const { value } = enrichKeywordEntries({ keywords: nextKeywords, context: currentContext, previous: prev });
        nextValue = value;
      } else {
        nextValue = { ...prev, keywords: nextKeywords };
      }

      const nextString = serializeKeywords(nextValue.keywords);
      
      // Отложить коммит до следующего цикла
      setPendingCommit({ value: nextValue, string: nextString });
      
      return nextValue;
    });
  }, []);

  // Автообогащение keywords ТОЛЬКО если stats еще нет совсем
  useEffect(() => {
    const currentContext = contextRef.current;
    if (!currentContext) return;
    if (pendingCommit) return;

    const { keywords } = localValue;
    if (keywords.length === 0) return;
    
    // Обогащаем ТОЛЬКО если нет статистики (первый раз)
    const hasNoStats = keywords.every(k => !k.cachedTotal && !k.cachedHeadings);
    if (!hasNoStats) return;

    const currentExternal = externalNormalizedRef.current;
    const { value, changed } = enrichKeywordEntries({ 
      keywords, 
      context: currentContext, 
      previous: currentExternal 
    });
    
    if (!changed) return;

    const nextString = serializeKeywords(value.keywords);
    setLocalValue(value);
    setPendingCommit({ value, string: nextString });
  }, [contextSignature, pendingCommit, localValue]);

  const handleRecalculate = useCallback(() => {
    const currentContext = contextRef.current;
    if (!currentContext) return;

    const { keywords } = localValue;
    if (keywords.length === 0) return;

    const currentExternal = externalNormalizedRef.current;
    const { value } = enrichKeywordEntries({ 
      keywords, 
      context: currentContext, 
      previous: currentExternal 
    });

    const nextString = serializeKeywords(value.keywords);
    setLocalValue(value);
    setPendingCommit({ value, string: nextString });
  }, [localValue]);

  const handleAdd = useCallback(() => {
    applyKeywords((prev) => [
      ...prev.keywords,
      {
        keyword: '',
        notes: '',
        linksCount: 0,
        cachedTotal: 0,
        cachedHeadings: 0,
      },
    ]);
  }, [applyKeywords]);

  const handleRemove = useCallback(
    (index: number) => {
      applyKeywords((prev) => prev.keywords.filter((_, idx) => idx !== index));
    },
    [applyKeywords]
  );

  const handleKeywordChange = useCallback(
    (index: number, field: keyof KeywordEntry, value: string) => {
      applyKeywords((prev) => prev.keywords.map((entry, idx) => {
        if (idx !== index) return entry;
        if (field === 'linksCount') {
          const numeric = Number(value);
          return { ...entry, linksCount: Number.isNaN(numeric) ? 0 : numeric };
        }
        return { ...entry, [field]: value };
      }));
    },
    [applyKeywords]
  );

  const keywordRows = useMemo(() => {
    return localValue.keywords.map((entry, index) => {
      const { keyword, notes, linksCount, cachedTotal, cachedHeadings } = entry;
      const totalValue = cachedTotal ?? 0;
      const headingsValue = cachedHeadings ?? 0;
      const strength = totalValue >= 5 ? 'success' : totalValue >= 3 ? 'warning' : 'critical';
      const headingsTone = headingsValue >= 1 ? 'success' : 'warning';

      return (
        <div className="navi-keyword-row" key={`${index}-${keyword || 'empty'}`}>
          <div className="navi-keyword-row__header">
            <div className="navi-keyword-row__title">Ключевое слово #{index + 1}</div>
            <div className="navi-keyword-row__actions">
              <button
                type="button"
                className="navi-btn navi-btn--danger"
                onClick={() => handleRemove(index)}
              >
                Удалить
              </button>
            </div>
          </div>

          <div className="navi-keyword-row__grid">
            <label className="navi-field">
              <span className="navi-field__label">Анкор</span>
              <input
                className="navi-input"
                type="text"
                value={keyword}
                placeholder="Например: обучение яхтингу"
                onChange={(event) => handleKeywordChange(index, 'keyword', event.target.value)}
              />
            </label>

            <label className="navi-field">
              <span className="navi-field__label">Примечание</span>
              <textarea
                className="navi-textarea"
                value={notes ?? ''}
                rows={2}
                placeholder="Контекст, где использовать ссылку"
                onChange={(event) => handleKeywordChange(index, 'notes', event.target.value)}
              />
            </label>

            <label className="navi-field navi-field--compact">
              <span className="navi-field__label">Ссылок</span>
              <input
                className="navi-input"
                type="number"
                min={0}
                value={linksCount ?? 0}
                title={LINKS_HINT}
                onChange={(event) => handleKeywordChange(index, 'linksCount', event.target.value)}
              />
            </label>

            <div className="navi-metric-pill navi-metric-pill--total" data-tone={strength}>
              <span className="navi-metric-pill__label">Всего вхождений</span>
              <strong className="navi-metric-pill__value">{totalValue}</strong>
            </div>

            <div className="navi-metric-pill" data-tone={headingsTone}>
              <span className="navi-metric-pill__label">В заголовках</span>
              <strong className="navi-metric-pill__value">{headingsValue}</strong>
            </div>
          </div>
        </div>
      );
    });
  }, [localValue.keywords, handleKeywordChange, handleRemove]);

  return (
    <div className="navi-keywords">
      <div className="navi-keywords__header">
        <div>
          <strong>Link Keywords</strong>
          {localValue.statsUpdatedAt && (
            <span className="navi-keywords__timestamp">
              Посл. пересчет: {new Date(localValue.statsUpdatedAt).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          )}
        </div>
        <div className="navi-keywords__actions">
          <button 
            type="button" 
            className="navi-btn navi-btn--secondary" 
            onClick={handleRecalculate}
            disabled={localValue.keywords.length === 0}
            title="Пересчитать вхождения ключевых слов в контенте"
          >
            Пересчитать
          </button>
          <button type="button" className="navi-btn navi-btn--secondary" onClick={handleAdd}>
            Добавить ключевое слово
          </button>
        </div>
      </div>

      {localValue.keywords.length === 0 ? (
        <div className="navi-keywords__empty">
          <p>Нет ключевых слов. Добавьте анкор, чтобы управлять внутренними ссылками.</p>
          <button type="button" className="navi-btn navi-btn--secondary" onClick={handleAdd}>
            Добавить первое слово
          </button>
        </div>
      ) : (
        <div className="navi-keywords__list">{keywordRows}</div>
      )}

      <style jsx>{`
        .navi-keywords {
          border: 1px solid var(--theme-elevation-150);
          border-radius: 0.75rem;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: var(--theme-elevation-0);
        }

        .navi-keywords__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .navi-keywords__actions {
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .navi-keywords__timestamp {
          display: block;
          font-size: 0.75rem;
          color: var(--theme-elevation-500);
          margin-top: 0.25rem;
        }

        .navi-btn {
          padding: 0.5rem 1rem;
          border: 1px solid var(--theme-elevation-200);
          border-radius: 0.5rem;
          background: var(--theme-elevation-0);
          color: var(--theme-text);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          transition: all 0.15s ease;
        }

        .navi-btn:hover:not(:disabled) {
          background: var(--theme-elevation-50);
          border-color: var(--theme-elevation-300);
        }

        .navi-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .navi-btn--secondary {
          background: var(--theme-elevation-100);
        }

        .navi-btn--danger {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #dc2626;
        }

        .navi-btn--danger:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.4);
        }

        .navi-keywords__empty {
          border: 1px dashed var(--theme-elevation-200);
          border-radius: 0.75rem;
          padding: 1rem;
          text-align: center;
          color: var(--theme-elevation-500);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          align-items: center;
        }

        .navi-keywords__list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .navi-keyword-row {
          border: 1px solid var(--theme-elevation-150);
          border-radius: 0.75rem;
          padding: 1rem;
          background: var(--theme-elevation-50);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .navi-keyword-row__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .navi-keyword-row__title {
          font-weight: 600;
          color: var(--theme-elevation-600);
        }

        .navi-keyword-row__actions {
          display: flex;
          gap: 0.5rem;
        }

        .navi-keyword-row__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          align-items: start;
        }

        .navi-field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .navi-field__label {
          font-size: 0.8rem;
          color: var(--theme-elevation-500);
        }

        .navi-input,
        .navi-textarea {
          width: 100%;
          border: 1px solid var(--theme-elevation-200);
          border-radius: 0.5rem;
          padding: 0.5rem 0.65rem;
          font-size: 0.95rem;
          background: var(--theme-elevation-0);
          color: inherit;
        }

        .navi-textarea {
          resize: vertical;
          min-height: 2.5rem;
        }

        .navi-field--compact {
          max-width: 140px;
        }

        .navi-metric-pill {
          border-radius: 0.75rem;
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          background: rgba(148, 163, 184, 0.18);
          border: 1px solid rgba(148, 163, 184, 0.25);
        }

        .navi-metric-pill--total {
          min-width: 150px;
        }

        .navi-metric-pill[data-tone='success'] {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.35);
          color: #047857;
        }

        .navi-metric-pill[data-tone='warning'] {
          background: rgba(251, 191, 36, 0.2);
          border-color: rgba(251, 191, 36, 0.35);
          color: #b45309;
        }

        .navi-metric-pill[data-tone='critical'] {
          background: rgba(248, 113, 113, 0.2);
          border-color: rgba(248, 113, 113, 0.35);
          color: #b91c1c;
        }

        .navi-metric-pill__label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .navi-metric-pill__value {
          font-size: 1.15rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
};

export default SeoKeywordManager;
