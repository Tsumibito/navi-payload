'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useDocumentInfo } from '@payloadcms/ui';
import { useFormFields } from '@payloadcms/ui';

type RelationshipValue = {
  relationTo: string;
  value: string | number;
  _label?: string;
};

type TagSummary = {
  id: string;
  label?: string | null;
};

type DefineTagsResponse = {
  success: boolean;
  tagIds: string[];
  totalTags: number;
  selectedCount: number;
  selectedTags?: TagSummary[];
  addedCount?: number;
  totalCount?: number;
};

const TAG_RELATION = 'tags-new';

const mapTagSummariesToRelationship = (summaries: TagSummary[]): RelationshipValue[] =>
  summaries.map(({ id, label }) => ({
    relationTo: TAG_RELATION,
    value: id,
    ...(label ? { _label: label } : {}),
  }));

// Загружает названия тегов через API и обновляет поле
const loadTagLabels = async (
  tags: RelationshipValue[],
  dispatch: (action: { type: 'UPDATE'; path: string; value: unknown }) => void
): Promise<void> => {
  const tagIds = tags.map((tag) => String(tag.value)).filter(Boolean);
  if (!tagIds.length) return;

  try {
    const response = await fetch(`/api/tags-new?where[id][in]=${tagIds.join(',')}&limit=${tagIds.length}&locale=ru`);
    if (!response.ok) return;

    const data = await response.json();
    const tagsWithLabels = Array.isArray(data?.docs) ? data.docs : [];

    const labelsMap = new Map<string, string>();
    for (const tag of tagsWithLabels) {
      if (tag?.id && tag?.name) {
        // name может быть строкой или объектом с локалями
        const name = typeof tag.name === 'string' ? tag.name : tag.name?.ru || tag.name?.en || '';
        if (name) {
          labelsMap.set(String(tag.id), name);
        }
      }
    }

    // Обновляем теги с загруженными названиями
    const updatedTags = tags.map((tag) => ({
      ...tag,
      _label: labelsMap.get(String(tag.value)) || tag._label,
    }));

    dispatch({
      type: 'UPDATE',
      path: 'tags',
      value: updatedTags,
    });
  } catch (err) {
    console.error('Failed to load tag labels:', err);
  }
};

export const DefineTagsButton: React.FC = () => {
  const docInfo = useDocumentInfo();
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const formState = useFormFields(([fields, dispatch]) => ({
    tagsField: fields?.tags,
    dispatch,
  }));

  const dispatch = formState?.dispatch;
  const currentTags = formState?.tagsField?.value;

  const postId = useMemo(() => {
    if (!docInfo || typeof docInfo !== 'object') {
      return null;
    }

    const maybeId = (docInfo as { id?: unknown }).id;
    if (typeof maybeId === 'string' || typeof maybeId === 'number') {
      return String(maybeId);
    }

    return null;
  }, [docInfo]);

  const applyTags = useCallback(
    (relations: RelationshipValue[]) => {
      if (!dispatch) {
        return;
      }

      dispatch({
        type: 'UPDATE',
        path: 'tags',
        value: relations,
      });
    },
    [dispatch],
  );

  const handleClick = useCallback(async () => {
    if (isRunning) {
      return;
    }

    setError(null);
    setStatus('Подготовка запроса…');

    if (!postId) {
      setError('Сохраните пост перед определением тегов');
      return;
    }

    if (!dispatch) {
      setError('Не удалось получить доступ к форме');
      return;
    }

    setIsRunning(true);
    const previousTags = Array.isArray(currentTags)
      ? currentTags
          .map((item: unknown) => {
            if (!item || typeof item !== 'object') {
              return null;
            }

            const { relationTo, value, _label } = item as {
              relationTo?: unknown;
              value?: unknown;
              _label?: unknown;
            };

            if (relationTo !== TAG_RELATION) {
              return null;
            }

            if (typeof value === 'string' || typeof value === 'number') {
              return {
                relationTo: TAG_RELATION,
                value,
                ...(typeof _label === 'string' && _label.trim() ? { _label } : {}),
              } satisfies RelationshipValue;
            }

            return null;
          })
          .filter((entry): entry is RelationshipValue => Boolean(entry))
      : [];

    try {
      const response = await fetch('/api/ai/define-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId }),
      });

      setStatus('Анализ тегов…');

      const data = (await response.json()) as DefineTagsResponse & { error?: string };

      if (!response.ok) {
        const message = data?.error || 'Не удалось определить теги';
        throw new Error(message);
      }

      if (!data?.tagIds || !Array.isArray(data.tagIds)) {
        throw new Error('Ответ сервера не содержит списка тегов');
      }

      setStatus('Обновление тегов…');
      
      // Перезагружаем пост с сервера, чтобы получить актуальный список тегов после merge
      const updatedPostResponse = await fetch(`/api/posts-new/${postId}?depth=0&locale=ru`);
      if (!updatedPostResponse.ok) {
        throw new Error('Не удалось загрузить обновленный пост');
      }
      
      const updatedPost = await updatedPostResponse.json();
      const allTags = Array.isArray(updatedPost.tags) ? updatedPost.tags : [];
      
      setStatus('Применение тегов…');
      applyTags(allTags);
      
      // Загружает названия тегов через API
      setStatus('Загрузка названий тегов…');
      await loadTagLabels(allTags, dispatch);
      
      const addedCount = data.addedCount ?? 0;
      const totalCount = data.totalCount ?? allTags.length;
      
      setStatus(
        `Добавлено ${addedCount} новых тегов (всего ${totalCount})`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(message);
      applyTags(previousTags);
    } finally {
      setIsRunning(false);
      setStatus((prev) => (prev && prev.startsWith('Добавлено') ? prev : null));
    }
  }, [
    applyTags,
    currentTags,
    dispatch,
    isRunning,
    postId,
  ]);

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
        onClick={handleClick}
        disabled={isRunning}
        aria-label={isRunning ? 'Определение тегов' : 'Определить теги'}
        title={isRunning ? 'Определение тегов' : 'Определить теги'}
        style={{
          padding: '0.4rem 0.85rem',
          minHeight: '2rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '9999px',
          backgroundColor: isRunning ? '#e5e7eb' : '#2563eb',
          color: isRunning ? '#6b7280' : '#ffffff',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          boxShadow: isRunning ? 'none' : '0 1px 4px rgba(37, 99, 235, 0.35)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          fontSize: '0.85rem',
          fontWeight: 600,
          lineHeight: 1,
          gap: '0.35rem',
        }}
        onMouseDown={(event) => {
          if (isRunning) return;
          event.currentTarget.style.transform = 'scale(0.97)';
        }}
        onMouseUp={(event) => {
          event.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <span aria-hidden="true" style={{ lineHeight: 1 }}>
          {isRunning ? '…' : '✨'}
        </span>
        <span>{isRunning ? 'Определение…' : 'Define Tags'}</span>
      </button>
      {status && (
        <span
          style={{
            color: 'var(--theme-success-500, #16a34a)',
            fontSize: '0.75rem',
            flexBasis: '100%',
          }}
        >
          {status}
        </span>
      )}
      {error && (
        <span
          style={{
            color: 'var(--theme-error-500, #dc2626)',
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

export default DefineTagsButton;
