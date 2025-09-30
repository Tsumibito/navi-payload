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
} from '@payloadcms/richtext-lexical';

const POSTS_SLUG = 'posts' as unknown as CollectionSlug;
const TAGS_SLUG = 'tags' as unknown as CollectionSlug;

/**
 * Конфигурация редактора с отключенным h1
 */
export const contentEditorFeatures = [
  ParagraphFeature(),
  HeadingFeature({
    enabledHeadingSizes: ['h2', 'h3', 'h4', 'h5', 'h6'],
  }),
  BoldFeature(),
  ItalicFeature(),
  UnderlineFeature(),
  StrikethroughFeature(),
  InlineCodeFeature(),
  UnorderedListFeature(),
  OrderedListFeature(),
  LinkFeature({
    enabledCollections: [POSTS_SLUG, TAGS_SLUG],
  }),
  HorizontalRuleFeature(),
  UploadFeature(),
  RelationshipFeature({
    enabledCollections: [POSTS_SLUG, TAGS_SLUG],
  }),
];
