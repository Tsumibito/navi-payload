'use client';

import React from 'react';
import { useFormFields } from '@payloadcms/ui';
import { generateSlug } from '../utils/slug';

interface GenerateSlugButtonProps {
  sourceField?: string;
  targetField?: string;
  path?: string;
}

export const GenerateSlugButton: React.FC<GenerateSlugButtonProps> = ({
  sourceField = 'name',
  targetField = 'slug',
  path,
}) => {
  // ВАЖНО: useFormFields вызываем ТОЛЬКО ОДИН РАЗ
  const formData = useFormFields(([fields, dispatch]) => ({
    source: fields[sourceField],
    dispatchFields: dispatch,
  }));
  
  const { source, dispatchFields } = formData;

  const handleGenerate = () => {
    if (!source?.value) return;

    const slug = generateSlug(source.value as string);
    dispatchFields({
      type: 'UPDATE',
      path: path || targetField,
      value: slug,
    });
  };

  const handlePress = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!source?.value) return;
    event.currentTarget.style.transform = 'scale(0.97)';
  };

  const handleRelease = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.style.transform = 'scale(1)';
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
        disabled={!source?.value}
        aria-label="Generate Slug"
        title="Generate Slug"
        style={{
          padding: '0.4rem 0.85rem',
          minHeight: '2rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '9999px',
          backgroundColor: !source?.value ? '#e5e7eb' : '#2563eb',
          color: !source?.value ? '#6b7280' : '#ffffff',
          cursor: !source?.value ? 'not-allowed' : 'pointer',
          boxShadow: !source?.value ? 'none' : '0 1px 4px rgba(37, 99, 235, 0.35)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          fontSize: '0.85rem',
          fontWeight: 600,
          lineHeight: 1,
          gap: '0.35rem',
        }}
        onMouseDown={handlePress}
        onMouseUp={handleRelease}
        onMouseLeave={handleRelease}
      >
        <span aria-hidden="true" style={{ lineHeight: 1 }}>✨</span>
        <span>Generate Slug</span>
      </button>
    </span>
  );
};

export default GenerateSlugButton;
