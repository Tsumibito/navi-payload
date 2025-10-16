'use client';

import React, { useState } from 'react';
import { useDocumentInfo, Button } from '@payloadcms/ui';
import { AIFaqGeneratorDialog } from './AIFaqGeneratorDialog';

/**
 * Кнопка для открытия AI FAQ Generator
 * Отображается в admin панели Posts
 */
export const AIFaqGeneratorButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const docInfo = useDocumentInfo();

  console.log('[AIFaqGeneratorButton] docInfo:', docInfo);

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
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
