'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { useFormFields } from '@payloadcms/ui';

interface GenerateSummaryButtonProps {
  contentField?: string;
  titleField?: string;
  targetField?: string;
  languageField?: string;
  defaultLanguage?: 'ru' | 'ua' | 'en';
  kind?: 'post' | 'tag';
  path?: string;
}

export const GenerateSummaryButton: React.FC<GenerateSummaryButtonProps> = ({
  contentField = 'content',
  titleField = 'name',
  targetField = 'summary',
  languageField,
  defaultLanguage = 'ru',
  kind = 'post',
  path,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const content = useFormFields(([fields]) => fields[contentField]);
  const title = useFormFields(([fields]) => fields[titleField]);
  const language = useFormFields(([fields]) =>
    languageField ? fields[languageField] : null
  );
  const { dispatchFields } = useFormFields(([, dispatch]) => ({ dispatchFields: dispatch }));
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const container = button.parentElement;
    if (!container) return;

    // Контейнер с textarea и кнопкой в одну линию
    container.style.display = 'flex';
    container.style.alignItems = 'flex-start';
    container.style.gap = '0.5rem';

    const textarea = container.querySelector('textarea');
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.style.flex = '1';
      textarea.style.minWidth = '0';
    }

    // Кнопка справа от textarea
    button.style.flexShrink = '0';
    button.style.marginTop = '0';

    // Описание под полем
    const fieldWrapper = container.parentElement;
    const description = fieldWrapper?.querySelector('[data-element="description"], .field-description, .field__description');
    if (description instanceof HTMLElement) {
      description.style.display = 'block';
      description.style.marginTop = '0.5rem';
      description.style.width = '100%';
    }
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      let textContent = '';
      if (content?.value) {
        if (typeof content.value === 'string') {
          textContent = content.value;
        } else if (typeof content.value === 'object' && content.value !== null) {
          const extractText = (node: Record<string, unknown>): string => {
            if (typeof node.text === 'string') return node.text;
            if (Array.isArray(node.children)) {
              return node.children.map((child) => extractText(child as Record<string, unknown>)).join(' ');
            }
            return '';
          };
          const rootNode = content.value as Record<string, unknown>;
          if (rootNode.root && typeof rootNode.root === 'object' && rootNode.root !== null) {
            const root = rootNode.root as Record<string, unknown>;
            if (Array.isArray(root.children)) {
              textContent = root.children.map((child) => extractText(child as Record<string, unknown>)).join('\n');
            }
          }
        }
      }

      if (!textContent || textContent.trim().length < 50) {
        setError('Контент слишком короткий для генерации описания');
        setIsGenerating(false);
        return;
      }

      const lang = language?.value || defaultLanguage;

      const response = await fetch('/api/ai/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: textContent,
          language: lang,
          title: title?.value || '',
          kind,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();

      dispatchFields({
        type: 'UPDATE',
        path: path || targetField,
        value: data.summary,
      });
    } catch (err) {
      console.error('Error generating summary:', err);
      setError('Ошибка генерации описания');
    } finally {
      setIsGenerating(false);
    }
  };

  const size = 'var(--field-input-height, 2.75rem)';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        aria-label={isGenerating ? 'Генерация описания' : 'Сгенерировать описание'}
        title={isGenerating ? 'Генерация описания' : 'Сгенерировать описание'}
        style={{
          height: size,
          width: size,
          minHeight: '2.5rem',
          minWidth: '2.5rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '0.5rem',
          backgroundColor: isGenerating ? '#9ca3af' : '#2563eb',
          color: '#ffffff',
          cursor: isGenerating ? 'not-allowed' : 'pointer',
          boxShadow: isGenerating ? 'none' : '0 0 0 1px rgba(37, 99, 235, 0.25)',
          transition: 'background-color 0.2s ease, transform 0.1s ease',
          marginLeft: '0.5rem',
        }}
        onMouseDown={(event) => {
          if (isGenerating) return;
          event.currentTarget.style.transform = 'scale(0.95)';
        }}
        onMouseUp={(event) => {
          event.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{isGenerating ? '…' : '✨'}</span>
      </button>
      {error && (
        <span
          style={{
            color: 'var(--theme-error-500, #ef4444)',
            fontSize: '0.75rem',
            flexBasis: '100%',
            textAlign: 'right',
          }}
        >
          {error}
        </span>
      )}
    </>
  );
};

export default GenerateSummaryButton;
