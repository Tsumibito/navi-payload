'use client';

import React, { useState } from 'react';
import { useDocumentInfo, Button } from '@payloadcms/ui';
import { AIFaqGeneratorDialog } from './AIFaqGeneratorDialog';

/**
 * Кнопка для открытия AI FAQ Generator
 * Отображается в admin панели коллекций с поддержкой FAQ (posts-new, tags-new)
 */
type SupportedCollection = 'posts-new' | 'tags-new';

interface AIFaqGeneratorButtonProps {
  collectionSlug?: SupportedCollection;
  [key: string]: unknown;
}

export const AIFaqGeneratorButton: React.FC<AIFaqGeneratorButtonProps> = ({ collectionSlug }) => {
  const [isOpen, setIsOpen] = useState(false);
  const docInfo = useDocumentInfo();

  const locationCollectionSlug = (() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const match = window.location.pathname.match(/\/collections\/(posts-new|tags-new)/);
    return match ? (match[1] as SupportedCollection) : null;
  })();

  const inferredCollectionSlug = (() => {
    if (docInfo && typeof docInfo === 'object') {
      const { collection, collectionSlug: docCollectionSlug } = docInfo as {
        collection?: unknown;
        collectionSlug?: unknown;
      };

      const maybe = [collection, docCollectionSlug].find(
        value => typeof value === 'string' && (value === 'posts-new' || value === 'tags-new')
      );

      if (typeof maybe === 'string') {
        return maybe as SupportedCollection;
      }
    }
    return null;
  })();

  const effectiveCollectionSlug: SupportedCollection =
    collectionSlug ?? inferredCollectionSlug ?? locationCollectionSlug ?? 'posts-new';

  console.log('[AIFaqGeneratorButton] docInfo:', docInfo, 'effectiveCollection:', effectiveCollectionSlug);

  const handleClick = () => {
    console.log('[AIFaqGeneratorButton] Button clicked');
    setIsOpen(true);
  };

  // Показываем кнопку только для существующих постов
  if (!docInfo?.id) {
    console.log('[AIFaqGeneratorButton] No docInfo.id, rendering fallback button');
    // Рендерим кнопку в любом случае для тестирования
    return (
      <div style={{ padding: '1rem', background: '#f0f0f0', borderRadius: '4px', marginBottom: '1rem' }}>
        <Button
          onClick={handleClick}
          buttonStyle="secondary"
          size="medium"
        >
          🤖 Generate FAQ with AI (Debug Mode)
        </Button>
        {isOpen && (
          <AIFaqGeneratorDialog
            postId="test"
            collectionSlug={effectiveCollectionSlug}
            onClose={() => setIsOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', background: '#e8f5e9', borderRadius: '4px', marginBottom: '1rem' }}>
      <Button
        onClick={handleClick}
        buttonStyle="secondary"
        size="medium"
      >
        🤖 Generate FAQ with AI
      </Button>

      {isOpen && (
        <AIFaqGeneratorDialog
          postId={docInfo.id as string}
          collectionSlug={effectiveCollectionSlug}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
