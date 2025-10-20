import type { CollectionConfig, CollectionSlug } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { simpleEditorFeatures } from '../utils/lexicalConfig';
import { createSeoField } from '../fields/seo';

const POSTS_RELATION = 'posts-new' as unknown as CollectionSlug;

export const Team: CollectionConfig = {
  slug: 'team-new',
  labels: {
    singular: 'Team Member',
    plural: 'Team',
  },
  versions: false,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'position', 'email'],
    description: 'Team members with native Payload i18n',
    group: 'Content',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              type: 'upload',
              name: 'photo',
              label: 'Photo',
              relationTo: 'media',
              // НЕ локализовано - общее для всех языков
              admin: {
                description: 'Team member photo',
              },
            },
            {
              type: 'text',
              name: 'name',
              label: 'Full Name',
              localized: true, // ✅ Нативная локализация
              admin: {
                description: 'Team member full name (localized)',
              },
            },
            {
              type: 'text',
              name: 'slug',
              label: 'Slug',
              required: true,
              unique: true,
              localized: true, // ✅ Локализовано - зависит от языка
              admin: {
                description: 'URL-friendly identifier per language',
              },
            },
            {
              type: 'text',
              name: 'position',
              label: 'Position / Title',
              localized: true, // ✅ Нативная локализация
              admin: {
                description: 'Job title or role (localized)',
              },
            },
            {
              type: 'richText',
              name: 'bio_summary',
              label: 'Bio Summary',
              localized: true, // ✅ Нативная локализация
              editor: lexicalEditor({
                features: simpleEditorFeatures,
              }),
              admin: {
                description: 'Short bio summary (1-2 sentences, localized)',
              },
            },
            {
              type: 'richText',
              name: 'bio',
              label: 'Biography',
              localized: true, // ✅ Нативная локализация
              editor: lexicalEditor({
                features: simpleEditorFeatures,
              }),
              admin: {
                description: 'Full biography (localized)',
              },
            },
            {
              type: 'relationship',
              name: 'posts',
              label: 'Posts',
              relationTo: [POSTS_RELATION],
              hasMany: true,
              maxDepth: 0,
              // НЕ локализовано - связи общие
              admin: {
                description: 'Posts authored by this team member',
              },
            },
            {
              type: 'number',
              name: 'order',
              label: 'Display Order',
              defaultValue: 0,
              // НЕ локализовано - общее для всех языков
              admin: {
                description: 'Order in team list (lower = first)',
              },
            },
          ],
        },
        {
          label: 'Contact',
          fields: [
            {
              type: 'array',
              name: 'links',
              label: 'Contact & Social Links',
              fields: [
                {
                  type: 'select',
                  name: 'service',
                  label: 'Service',
                  required: true,
                  options: [
                    { label: 'Email', value: 'email' },
                    { label: 'Phone', value: 'phone' },
                    { label: 'Twitter/X', value: 'x' },
                    { label: 'Facebook', value: 'facebook' },
                    { label: 'Instagram', value: 'instagram' },
                    { label: 'LinkedIn', value: 'linkedin' },
                    { label: 'GitHub', value: 'github' },
                    { label: 'Website', value: 'website' },
                  ],
                },
                {
                  type: 'text',
                  name: 'url',
                  label: 'URL',
                  required: true,
                  admin: {
                    description: 'For email: mailto:email@example.com, for phone: tel:+1234567890',
                  },
                },
              ],
              admin: {
                initCollapsed: true,
                description: 'Contact information and social media links',
              },
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
                  localized: true, // ✅ Переводится на язык страницы
                  admin: {
                    description: 'FAQ question (localized)',
                  },
                },
                {
                  type: 'richText',
                  name: 'answer',
                  label: 'Answer',
                  required: true,
                  localized: true, // ✅ Переводится на язык страницы
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
                description: 'FAQ section for this team member page',
              },
            },
          ],
        },
      ],
    },
  ],
};
