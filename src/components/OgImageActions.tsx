'use client';

import React, { useCallback, useState } from 'react';
import { useFormFields } from '@payloadcms/ui';

type PayloadFieldState = {
  value?: unknown;
};

type PayloadAfterFieldProps = {
  path?: string;
  field?: { name?: string };
};

type CollectionConfig = {
  imageField: string; // Поле с основным изображением
  urlPattern: string; // Паттерн URL: /ru/{collection}/{slug}
  collection: string; // Название коллекции для URL
};

const COLLECTION_CONFIGS: Record<string, CollectionConfig> = {
  posts: {
    imageField: 'image',
    urlPattern: '/ru/blog/{slug}',
    collection: 'blog',
  },
  tags: {
    imageField: 'image',
    urlPattern: '/ru/tags/{slug}',
    collection: 'tags',
  },
  team: {
    imageField: 'photo',
    urlPattern: '/ru/team/{slug}',
    collection: 'team',
  },
};

function resolveFieldValue(fields: Record<string, PayloadFieldState> | undefined, identifiers: (string | undefined)[], fallback?: unknown) {
  if (!fields) return fallback;
  const keys = Object.keys(fields);
  const tryResolve = (key: string | undefined): unknown => {
    if (!key) return undefined;
    const fieldState = fields[key] as PayloadFieldState | undefined;
    return fieldState?.value;
  };

  for (const identifier of identifiers) {
    const value = tryResolve(identifier);
    if (value !== undefined) return value;
  }

  for (const identifier of identifiers) {
    if (!identifier) continue;
    const match = keys.find((key) => key === identifier || key.endsWith(`.${identifier}`));
    if (match) {
      const value = tryResolve(match);
      if (value !== undefined) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('OgImageActions: resolved field path', { identifier, match });
        }
        return value;
      }
    }
  }

  const suffixes = identifiers
    .map((identifier) => identifier?.split('.').pop())
    .filter((suffix): suffix is string => Boolean(suffix));
  for (const suffix of suffixes) {
    const match = keys.find((key) => key.endsWith(`.${suffix}`));
    if (match) {
      const value = tryResolve(match);
      if (value !== undefined) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('OgImageActions: resolved by suffix', { suffix, match });
        }
        return value;
      }
    }
  }

  return fallback;
}

function useFieldValue(...identifiers: (string | undefined)[]): unknown {
  return useFormFields(([fields]) => resolveFieldValue(fields as Record<string, PayloadFieldState> | undefined, identifiers));
}

export function OgImageActions(props: PayloadAfterFieldProps) {
  const { path, field } = props;
  const fieldPath = path ?? field?.name ?? 'seo.og_image';

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Определяем коллекцию из пути
  const basePath = fieldPath.includes('.seo.og_image') ? fieldPath.replace('.seo.og_image', '') : '';
  
  // Определяем коллекцию из URL
  const [config, setConfig] = React.useState<CollectionConfig | null>(null);

  React.useEffect(() => {
    const collectionMatch = window.location.pathname.match(/\/admin\/collections\/([^/]+)/);
    const coll = collectionMatch ? collectionMatch[1] : null;
    setConfig(coll && COLLECTION_CONFIGS[coll] ? COLLECTION_CONFIGS[coll] : null);
  }, []);

  // Получаем значения полей
  const imageFieldPath = config ? (basePath ? `${basePath}.${config.imageField}` : config.imageField) : undefined;
  const slugFieldPath = basePath ? `${basePath}.slug` : 'slug';
  const languageFieldPath = basePath ? `${basePath}.language` : 'language';

  // ВАЖНО: useFormFields вызываем ТОЛЬКО ОДИН РАЗ
  const formData = useFormFields(([fields, dispatch]) => ({
    imageValue: resolveFieldValue(fields as Record<string, PayloadFieldState> | undefined, [imageFieldPath, config?.imageField]),
    slugValue: resolveFieldValue(fields as Record<string, PayloadFieldState> | undefined, [slugFieldPath, 'slug']),
    languageValue: resolveFieldValue(fields as Record<string, PayloadFieldState> | undefined, [languageFieldPath, 'language']),
    dispatchFields: dispatch,
  }));
  
  const { imageValue, slugValue, languageValue, dispatchFields } = formData;

  const handleUseImage = useCallback(() => {
    if (!imageValue) {
      setError('Нет изображения для использования');
      return;
    }

    // Извлекаем ID из relationship
    let imageId: string | number | null = null;
    if (typeof imageValue === 'string') {
      imageId = imageValue;
    } else if (typeof imageValue === 'number') {
      imageId = imageValue;
    } else if (typeof imageValue === 'object' && imageValue !== null) {
      const obj = imageValue as Record<string, unknown>;
      // Пробуем разные варианты
      if (typeof obj.id === 'string' || typeof obj.id === 'number') {
        imageId = obj.id;
      } else if (typeof obj.value === 'string' || typeof obj.value === 'number') {
        imageId = obj.value;
      } else if (typeof obj.id === 'object' && obj.id !== null) {
        const nestedId = (obj.id as Record<string, unknown>).id;
        if (typeof nestedId === 'string' || typeof nestedId === 'number') {
          imageId = nestedId;
        }
      }
    }

    if (!imageId) {
      setError(`Не удалось получить ID изображения. Тип: ${typeof imageValue}, значение: ${JSON.stringify(imageValue)}`);
      return;
    }

    dispatchFields({ type: 'UPDATE', path: fieldPath, value: imageId });
    setError(null);
  }, [dispatchFields, fieldPath, imageValue]);

  const handleScreenshot = useCallback(async () => {
    if (!config) {
      setError('Неизвестная коллекция');
      return;
    }

    if (!slugValue || typeof slugValue !== 'string') {
      setError('Нет slug для создания скриншота');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Определяем язык
      const lang = typeof languageValue === 'string' ? languageValue : 'ru';
      
      // Формируем URL
      const url = `https://navi.training${config.urlPattern.replace('{slug}', slugValue).replace('/ru/', `/${lang}/`)}`;

      // Вызываем API для создания скриншота
      const response = await fetch('/api/screenshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 501) {
          throw new Error('Функция скриншотов еще не реализована. Требуется настроить Puppeteer/Playwright.');
        }
        throw new Error(data.error || `Ошибка создания скриншота: ${response.status}`);
      }
      
      if (!data.imageId) {
        throw new Error('API не вернул ID изображения');
      }

      dispatchFields({ type: 'UPDATE', path: fieldPath, value: data.imageId });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, [config, dispatchFields, fieldPath, languageValue, slugValue]);

  if (!config) {
    return null; // Не показываем кнопки для неподдерживаемых коллекций
  }

  const handlePress = (event: React.MouseEvent<HTMLButtonElement>) => {
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
        onClick={handleUseImage}
        disabled={!imageValue || isProcessing}
        aria-label={`Использовать ${config?.imageField === 'photo' ? 'фото' : 'изображение'}`}
        style={{
          padding: '0.4rem 0.85rem',
          minHeight: '2rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '9999px',
          backgroundColor: !imageValue || isProcessing ? '#e5e7eb' : '#2563eb',
          color: !imageValue || isProcessing ? '#6b7280' : '#ffffff',
          cursor: !imageValue || isProcessing ? 'not-allowed' : 'pointer',
          boxShadow: !imageValue || isProcessing ? 'none' : '0 1px 4px rgba(37, 99, 235, 0.35)',
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
        <span aria-hidden="true" style={{ lineHeight: 1 }}>🖼️</span>
        <span>Использовать {config?.imageField === 'photo' ? 'фото' : 'изображение'}</span>
      </button>

      <button
        type="button"
        onClick={handleScreenshot}
        disabled={!slugValue || isProcessing}
        aria-label="Сделать скриншот страницы"
        style={{
          padding: '0.4rem 0.85rem',
          minHeight: '2rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '9999px',
          backgroundColor: !slugValue || isProcessing ? '#e5e7eb' : '#10b981',
          color: !slugValue || isProcessing ? '#6b7280' : '#ffffff',
          cursor: !slugValue || isProcessing ? 'not-allowed' : 'pointer',
          boxShadow: !slugValue || isProcessing ? 'none' : '0 1px 4px rgba(16, 185, 129, 0.35)',
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
        <span aria-hidden="true" style={{ lineHeight: 1 }}>📸</span>
        <span>{isProcessing ? 'Создание...' : 'Сделать скриншот'}</span>
      </button>

      {error && (
        <div
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#dc2626',
            fontSize: '0.85rem',
            marginTop: '0.25rem',
          }}
        >
          {error}
        </div>
      )}
    </span>
  );
}

export default OgImageActions;
