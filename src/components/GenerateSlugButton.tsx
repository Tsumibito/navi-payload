'use client';

import React, { useLayoutEffect, useRef } from 'react';
import { useFormFields } from '@payloadcms/ui';
import { generateSlug } from '../utils/slug';

interface GenerateSlugButtonProps {
  sourceField?: string;
  targetField?: string;
  path?: string;
}

const DESCRIPTION_SELECTOR = '[data-element="description"], .field-description, .field__description';

export const GenerateSlugButton: React.FC<GenerateSlugButtonProps> = ({
  sourceField = 'name',
  targetField = 'slug',
  path,
}) => {
  const source = useFormFields(([fields]) => fields[sourceField]);
  const { dispatchFields } = useFormFields(([, dispatch]) => ({ dispatchFields: dispatch }));
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const container = wrapper.parentElement as HTMLElement | null;
    if (!container) return;

    const appliedStyles: Array<{ element: HTMLElement; property: string; previous: string }> = [];

    const setStyle = (element: HTMLElement, property: string, value: string) => {
      const previous = element.style.getPropertyValue(property);
      if (previous === value) return;

      element.style.setProperty(property, value);
      appliedStyles.push({ element, property, previous });
    };

    // Контейнер должен быть relative для абсолютного позиционирования кнопки
    setStyle(container, 'position', 'relative');
    setStyle(container, 'display', 'block');

    const input = container.querySelector('input');
    if (input instanceof HTMLInputElement) {
      // Добавляем padding справа для кнопки
      setStyle(input, 'padding-right', '2.25rem');
    }

    // Кнопка абсолютно позиционирована справа внутри поля
    wrapper.style.position = 'absolute';
    wrapper.style.right = '0.25rem';
    wrapper.style.top = '0.25rem';
    wrapper.style.bottom = '0.25rem';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.zIndex = '10';

    // Описание под полем
    const fieldWrapper = container.parentElement;
    const description = (fieldWrapper?.querySelector(DESCRIPTION_SELECTOR)) as HTMLElement | null;

    if (description) {
      setStyle(description, 'display', 'block');
      setStyle(description, 'margin-top', '0.5rem');
      setStyle(description, 'width', '100%');
    }

    return () => {
      for (const { element, property, previous } of appliedStyles.reverse()) {
        if (previous) {
          element.style.setProperty(property, previous);
        } else {
          element.style.removeProperty(property);
        }
      }
    };
  }, []);

  const handleGenerate = () => {
    if (!source?.value) return;

    const slug = generateSlug(source.value as string);
    dispatchFields({
      type: 'UPDATE',
      path: path || targetField,
      value: slug,
    });
  };

  return (
    <span ref={wrapperRef}>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!source?.value}
        aria-label="Сгенерировать slug"
        title="Сгенерировать slug"
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '0.25rem',
          backgroundColor: !source?.value ? '#93c5fd' : '#2563eb',
          color: '#ffffff',
          cursor: !source?.value ? 'not-allowed' : 'pointer',
          boxShadow: !source?.value ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          transition: 'all 0.2s ease',
        }}
        onMouseDown={(e) => {
          if (!source?.value) return;
          e.currentTarget.style.transform = 'scale(0.95)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <span style={{ fontSize: '1rem', lineHeight: 1 }}>✨</span>
      </button>
    </span>
  );
};

export default GenerateSlugButton;
