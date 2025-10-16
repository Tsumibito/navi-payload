import type { CollectionConfig, CollectionSlug } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { contentEditorFeatures, simpleEditorFeatures } from '../utils/lexicalConfig';
import { createSeoField } from '../fields/seo';
import { AIFaqGeneratorButton } from '../components/AIFaqGeneratorButton';

const TEAM_RELATION = 'team-new' as unknown as CollectionSlug;
const TAGS_RELATION = 'tags-new' as unknown as CollectionSlug;

export const Posts: CollectionConfig = {
  slug: 'posts-new',
  labels: {
    singular: 'Post',
    plural: 'Posts',
  },
  versions: false,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'published_at', 'featured'],
    description: 'Blog posts with native Payload i18n',
    group: 'Content',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              type: 'text',
              name: 'name',
              label: 'Title',
              localized: true, // ✅ Локализовано
              admin: {
                description: 'Post title (localized)',
              },
            },
            {
              type: 'text',
              name: 'slug',
              label: 'Slug',
              required: true,
              localized: true, // ✅ Локализовано - зависит от языка
              admin: {
                description: 'URL-friendly identifier per language',
              },
            },
            {
              type: 'upload',
              name: 'image',
              label: 'Featured Image',
              relationTo: 'media',
              // НЕ локализовано - общее для всех языков
              admin: {
                description: 'Main post image',
              },
            },
            {
              type: 'textarea',
              name: 'summary',
              label: 'Summary',
              localized: true, // ✅ Локализовано
              admin: {
                description: '1–2 sentence overview (localized)',
                components: {
                  afterInput: ['/src/components/GenerateSummaryButton#GenerateSummaryButton'],
                },
              },
            },
            {
              type: 'richText',
              name: 'content',
              label: 'Content',
              localized: true, // ✅ Локализовано
              editor: lexicalEditor({
                features: contentEditorFeatures,
              }),
              admin: {
                description: 'Main post content (localized)',
                style: {
                  maxWidth: '900px',
                },
              },
            },
            {
              type: 'relationship',
              name: 'authors',
              label: 'Authors',
              relationTo: [TEAM_RELATION],
              hasMany: true,
              // НЕ локализовано
              admin: {
                description: 'Select one or more team members as authors',
              },
            },
            {
              type: 'relationship',
              name: 'tags',
              label: 'Tags',
              relationTo: [TAGS_RELATION],
              hasMany: true,
              // НЕ локализовано
              admin: {
                description: 'Post tags',
              },
            },
            {
              type: 'checkbox',
              name: 'featured',
              label: 'Featured',
              defaultValue: false,
              // НЕ локализовано
              admin: {
                description: 'Mark as featured post',
              },
            },
          ],
        },
        {
          label: 'Social Images',
          fields: [
            {
              type: 'group',
              name: 'socialImages',
              label: 'Social Media Images',
              fields: [
                {
                  type: 'upload',
                  name: 'thumbnail',
                  label: 'Thumbnail',
                  relationTo: 'media',
                  // НЕ локализовано
                },
                {
                  type: 'upload',
                  name: 'image16x9',
                  label: 'Image 16:9',
                  relationTo: 'media',
                  // НЕ локализовано
                },
                {
                  type: 'upload',
                  name: 'image5x4',
                  label: 'Image 5:4',
                  relationTo: 'media',
                  // НЕ локализовано
                },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [createSeoField({ localized: true })],
        },
        {
          label: 'FAQs',
          fields: [
            // ✨ AI FAQ Generator Button
            {
              type: 'ui',
              name: 'aiFaqGenerator',
              admin: {
                components: {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  Field: AIFaqGeneratorButton as any,
                },
              },
            },
            {
              type: 'array',
              name: 'faqs',
              label: 'Frequently Asked Questions',
              fields: [
                {
                  type: 'text',
                  name: 'question',
                  label: 'Question',
                  required: true,
                  localized: true, // ✅ Локализовано
                  admin: {
                    description: 'FAQ question (localized)',
                  },
                },
                {
                  type: 'richText',
                  name: 'answer',
                  label: 'Answer',
                  required: true,
                  localized: true, // ✅ Локализовано
                  editor: lexicalEditor({
                    features: simpleEditorFeatures,
                  }),
                  admin: {
                    description: 'FAQ answer (localized)',
                  },
                },
              ],
              admin: {
                initCollapsed: true,
                description: 'FAQ section for this post',
              },
            },
          ],
        },
      ],
    },
  ],
};
