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

    const input = container.querySelector('input');
    if (input instanceof HTMLInputElement) {
      // Добавляем padding справа для кнопки
      setStyle(input, 'padding-right', '3.5rem');
    }

    // Кнопка абсолютно позиционирована справа внутри поля
    wrapper.style.position = 'absolute';
    wrapper.style.right = '0.5rem';
    wrapper.style.top = '50%';
    wrapper.style.transform = 'translateY(-50%)';
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.zIndex = '1';

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

  const size = 'var(--field-input-height, 2.75rem)';

  return (
    <span ref={wrapperRef}>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={!source?.value}
        aria-label="Сгенерировать slug"
        title="Сгенерировать slug"
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
          backgroundColor: !source?.value ? '#93c5fd' : '#2563eb',
          color: '#ffffff',
          cursor: !source?.value ? 'not-allowed' : 'pointer',
          boxShadow: !source?.value ? 'none' : '0 0 0 1px rgba(37, 99, 235, 0.25)',
          transition: 'background-color 0.2s ease, transform 0.1s ease',
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
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>✨</span>
      </button>
    </span>
  );
};

export default GenerateSlugButton;
