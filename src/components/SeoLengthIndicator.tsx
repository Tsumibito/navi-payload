'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useFormFields } from '@payloadcms/ui';

type PayloadFieldState = {
  value?: unknown;
};

type PayloadAfterFieldProps = {
  path?: string;
  field?: { name?: string };
  value?: unknown;
};

type Status = 'green' | 'yellow' | 'red';

type SeoLengthIndicatorProps = PayloadAfterFieldProps & {
  min: number;
  max: number;
};

const COLORS: Record<Status, string> = {
  green: '#16a34a',
  yellow: '#f59e0b',
  red: '#dc2626',
};

type ResolvedSeoField = {
  value: string;
  resolvedPath?: string;
};

const isDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const flag = (window as { __payloadDebug?: boolean }).__payloadDebug;
  return flag === undefined ? process.env.NODE_ENV !== 'production' : Boolean(flag);
};

const PRIORITY_KEYS = ['value', 'text', 'raw', 'string', 'defaultValue', 'initialValue', 'plainText'];

function extractStringValue(candidate: unknown, visited = new Set<unknown>()): string | undefined {
  if (typeof candidate === 'string') return candidate;
  if (candidate === null || candidate === undefined) return undefined;

  if (typeof candidate !== 'object') return undefined;
  if (visited.has(candidate)) return undefined;
  visited.add(candidate);

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const result = extractStringValue(item, visited);
      if (typeof result === 'string' && result.trim().length > 0) return result;
    }
    return undefined;
  }

  const record = candidate as Record<string, unknown>;

  for (const key of PRIORITY_KEYS) {
    if (key in record) {
      const result = extractStringValue(record[key], visited);
      if (typeof result === 'string' && result.trim().length > 0) return result;
    }
  }

  for (const value of Object.values(record)) {
    const result = extractStringValue(value, visited);
    if (typeof result === 'string' && result.trim().length > 0) return result;
  }

  return undefined;
}

// ВАЖНО: Этот хук должен вызывать useFormFields только ОДИН раз
function useResolvedSeoFieldValue(path?: string, name?: string, fallback = ''): ResolvedSeoField {
  const formFields = useFormFields(([fields]) => fields);
  
  return useMemo(() => {
    if (!formFields) return { value: fallback, resolvedPath: path ?? name };

    const identifiers = [path, name].filter((identifier): identifier is string => Boolean(identifier));
    const keys = Object.keys(formFields);

    const tryResolve = (key?: string): ResolvedSeoField | undefined => {
      if (!key) return undefined;
      const state = formFields[key] as PayloadFieldState | undefined;
      if (!state) return undefined;

      const candidates = [state.value, (state as { initialValue?: unknown }).initialValue];
      for (const candidate of candidates) {
        const text = extractStringValue(candidate);
        if (typeof text === 'string') {
          if (isDebugEnabled()) {
            console.log('SeoLengthIndicator: field state dump', { key, candidate, state });
          }
          return { value: text, resolvedPath: key };
        }
      }

      if (isDebugEnabled()) {
        console.log('SeoLengthIndicator: unresolved state', { key, state });
      }
      return undefined;
    };

    for (const identifier of identifiers) {
      const direct = tryResolve(identifier);
      if (direct) return direct;
    }

    for (const identifier of identifiers) {
      const match = keys.find((key) => key === identifier || key.endsWith(`.${identifier}`));
      if (match) {
        const resolved = tryResolve(match);
        if (resolved) return resolved;
      }
    }

    const suffixes = identifiers
      .map((identifier) => identifier.split('.').pop())
      .filter((suffix): suffix is string => Boolean(suffix));
    for (const suffix of suffixes) {
      const match = keys.find((key) => key.endsWith(`.${suffix}`));
      if (match) {
        const resolved = tryResolve(match);
        if (resolved) return resolved;
      }
    }

    if (isDebugEnabled()) {
      console.log('SeoLengthIndicator: fallback used', {
        identifiers,
        fallback,
        availableKeys: keys,
        snapshot: identifiers.map((identifier) => ({ identifier, state: identifier ? formFields[identifier] : undefined })),
      });
    }

    return { value: fallback, resolvedPath: path ?? name };
  }, [formFields, path, name, fallback]);
}

function calculateStatus(length: number, min: number, max: number): Status {
  if (length >= min && length <= max) {
    return 'green';
  }

  const lowerDelta = Math.round(min * 0.2);
  const upperDelta = Math.round(max * 0.2);
  const lowerYellow = Math.max(0, min - lowerDelta);
  const upperYellow = max + upperDelta;

  if (length >= lowerYellow && length <= upperYellow) {
    return 'yellow';
  }

  return 'red';
}

function buildStatusText(status: Status): string {
  switch (status) {
    case 'green':
      return 'В пределах оптимального диапазона.';
    case 'yellow':
      return 'Близко к оптимуму (±20%). Корректируйте при необходимости.';
    default:
      return 'Сильно отклоняется от оптимума. Требуется корректировка.';
  }
}

function SeoLengthIndicatorBase(props: SeoLengthIndicatorProps) {
  const { min, max, path, field, value } = props;
  const fallback = typeof value === 'string' ? value : '';
  const { value: resolvedValue, resolvedPath } = useResolvedSeoFieldValue(path, field?.name, fallback);
  const [domValue, setDomValue] = useState(fallback);

  useEffect(() => {
    setDomValue(fallback);
  }, [fallback]);

  useEffect(() => {
    if (typeof document === 'undefined' || !resolvedPath) return;

    const selector = `[name="${resolvedPath}"]`;
    const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);

    if (!element) {
      if (isDebugEnabled()) {
        console.log('SeoLengthIndicator: input element not found', { resolvedPath, selector });
      }
      return;
    }

    const readValue = () => {
      const nextValue = 'value' in element ? element.value : element.textContent ?? '';
      setDomValue(nextValue ?? '');
      if (isDebugEnabled()) {
        console.log('SeoLengthIndicator: DOM value updated', { resolvedPath, nextValue });
      }
    };

    readValue();

    element.addEventListener('input', readValue);
    element.addEventListener('change', readValue);

    return () => {
      element.removeEventListener('input', readValue);
      element.removeEventListener('change', readValue);
    };
  }, [resolvedPath]);

  const textValue = typeof resolvedValue === 'string' && resolvedValue.trim().length > 0 ? resolvedValue : domValue;
  if (process.env.NODE_ENV !== 'production') {
    console.log('SeoLengthIndicator: value snapshot', {
      fieldPath: path,
      fieldName: field?.name,
      resolvedPath,
      length: textValue.length,
    });
  }
  const length = textValue.trim().length;

  const status = useMemo(() => calculateStatus(length, min, max), [length, min, max]);
  const color = COLORS[status];
  const upperDelta = Math.round(max * 0.2);
  const upperLimitForBar = max + upperDelta;
  const progressRaw = upperLimitForBar > 0 ? length / upperLimitForBar : 0;
  const progress = Math.max(0, Math.min(progressRaw, 1));
  const progressPercent = `${(progress * 100).toFixed(1)}%`;

  return (
    <div style={{ width: '100%', marginTop: '0.4rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: '#6b7280',
          marginBottom: '0.25rem',
        }}
      >
        <span>{length} символов</span>
        <span>оптимум {min}–{max}</span>
      </div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '6px',
          borderRadius: '9999px',
          backgroundColor: '#e5e7eb',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: progressPercent,
            height: '100%',
            transition: 'width 0.15s ease',
            backgroundColor: color,
          }}
        />
      </div>
      <div
        style={{
          marginTop: '0.25rem',
          fontSize: '0.75rem',
          color,
        }}
      >
        {buildStatusText(status)}
      </div>
    </div>
  );
}

export function SeoTitleLengthIndicator(props: PayloadAfterFieldProps) {
  return <SeoLengthIndicatorBase min={50} max={60} {...props} />;
}

export function SeoMetaDescriptionLengthIndicator(props: PayloadAfterFieldProps) {
  return <SeoLengthIndicatorBase min={140} max={160} {...props} />;
}

export default SeoTitleLengthIndicator;
