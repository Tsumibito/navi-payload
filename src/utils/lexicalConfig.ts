import type { CollectionSlug } from 'payload';
import {
  BoldFeature,
  ItalicFeature,
  UnderlineFeature,
  StrikethroughFeature,
  InlineCodeFeature,
  ParagraphFeature,
  HeadingFeature,
  UnorderedListFeature,
  OrderedListFeature,
  LinkFeature,
  HorizontalRuleFeature,
  UploadFeature,
  RelationshipFeature,
  FixedToolbarFeature,
  InlineToolbarFeature,
  BlockquoteFeature,
  ChecklistFeature,
  AlignFeature,
  IndentFeature,
} from '@payloadcms/richtext-lexical';

const POSTS_SLUG = 'posts-new' as unknown as CollectionSlug;
const TAGS_SLUG = 'tags-new' as unknown as CollectionSlug;

/**
 * Конфигурация редактора с отключенным h1
 */
export const contentEditorFeatures = [
  // ✅ Фиксированная панель инструментов (всегда видна сверху)
  FixedToolbarFeature(),
  
  // ✅ Всплывающая панель при выделении текста
  InlineToolbarFeature(),
  
  // Базовые элементы
  ParagraphFeature(),
  HeadingFeature({
    enabledHeadingSizes: ['h2', 'h3', 'h4', 'h5', 'h6'],
  }),
  
  // Форматирование текста
  BoldFeature(),
  ItalicFeature(),
  UnderlineFeature(),
  StrikethroughFeature(),
  InlineCodeFeature(),
  BlockquoteFeature(),
  
  // Выравнивание и отступы
  AlignFeature(),
  IndentFeature(),
  
  // Списки
  UnorderedListFeature(),
  OrderedListFeature(),
  ChecklistFeature(),
  
  // Ссылки и медиа
  LinkFeature({
    enabledCollections: [POSTS_SLUG, TAGS_SLUG],
  }),
  HorizontalRuleFeature(),
  UploadFeature(),
  RelationshipFeature({
    enabledCollections: [POSTS_SLUG, TAGS_SLUG],
  }),
];

/**
 * Упрощенная конфигурация редактора для коротких текстов (bio, FAQs, etc.)
 */
export const simpleEditorFeatures = [
  // ✅ Фиксированная панель инструментов
  FixedToolbarFeature(),
  
  // ✅ Всплывающая панель при выделении
  InlineToolbarFeature(),
  
  // Базовые элементы
  ParagraphFeature(),
  HeadingFeature({
    enabledHeadingSizes: ['h2', 'h3', 'h4', 'h5', 'h6'],
  }),
  
  // Форматирование
  BoldFeature(),
  ItalicFeature(),
  UnderlineFeature(),
  StrikethroughFeature(),
  InlineCodeFeature(),
  BlockquoteFeature(),
  
  // Выравнивание и отступы
  AlignFeature(),
  IndentFeature(),
  
  // Списки
  UnorderedListFeature(),
  OrderedListFeature(),
  ChecklistFeature(),
  
  // Ссылки
  LinkFeature({
    enabledCollections: [],
  }),
];
