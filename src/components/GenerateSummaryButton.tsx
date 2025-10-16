'use client';

import React, { useState } from 'react';
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

  // ВАЖНО: useFormFields вызываем ТОЛЬКО ОДИН РАЗ
  const formData = useFormFields(([fields, dispatch]) => ({
    content: fields[contentField],
    title: fields[titleField],
    language: languageField ? fields[languageField] : null,
    dispatchFields: dispatch,
  }));
  
  const { content, title, language, dispatchFields } = formData;

  const handleGenerate = async () => {
    if (isGenerating) return;
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

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginTop: '0.4rem',
      }}
    >
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        aria-label={isGenerating ? 'Генерация описания' : 'Сгенерировать описание'}
        title={isGenerating ? 'Генерация описания' : 'Сгенерировать описание'}
        style={{
          padding: '0.4rem 0.85rem',
          minHeight: '2rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '9999px',
          backgroundColor: isGenerating ? '#e5e7eb' : '#2563eb',
          color: isGenerating ? '#6b7280' : '#ffffff',
          cursor: isGenerating ? 'not-allowed' : 'pointer',
          boxShadow: isGenerating ? 'none' : '0 1px 4px rgba(37, 99, 235, 0.35)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          fontSize: '0.85rem',
          fontWeight: 600,
          lineHeight: 1,
          gap: '0.35rem',
        }}
        onMouseDown={(event) => {
          if (isGenerating) return;
          event.currentTarget.style.transform = 'scale(0.97)';
        }}
        onMouseUp={(event) => {
          event.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <span aria-hidden="true" style={{ lineHeight: 1 }}>{isGenerating ? '…' : '✨'}</span>
        <span>{isGenerating ? 'Generating…' : 'Generate Summary'}</span>
      </button>
      {error && (
        <span
          style={{
            color: 'var(--theme-error-500, #ef4444)',
            fontSize: '0.75rem',
            flexBasis: '100%',
          }}
        >
          {error}
        </span>
      )}
    </span>
  );
};

export default GenerateSummaryButton;
