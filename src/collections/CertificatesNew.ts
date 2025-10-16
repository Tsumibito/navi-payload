import type { CollectionConfig } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { contentEditorFeatures } from '../utils/lexicalConfig';

export const CertificatesNew: CollectionConfig = {
  slug: 'certificates-new',
  labels: {
    singular: 'Certificate (New)',
    plural: 'Certificates (New)',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', '_status'],
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
              label: 'Name',
              required: true,
              localized: true, // ✅ Локализовано
              admin: {
                description: 'Certificate name (localized)',
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
              name: 'frontImage',
              label: 'Certificate Front Side',
              relationTo: 'media',
              // НЕ локализовано - общее изображение
              admin: {
                description: 'Front side of the certificate',
              },
            },
            {
              type: 'upload',
              name: 'backImage',
              label: 'Certificate Back Side',
              relationTo: 'media',
              // НЕ локализовано - общее изображение
              admin: {
                description: 'Back side of the certificate',
              },
            },
            {
              type: 'richText',
              name: 'description',
              label: 'Description',
              localized: true, // ✅ Локализовано
              editor: lexicalEditor({
                features: contentEditorFeatures,
              }),
              admin: {
                description: 'Certificate description (localized)',
                style: {
                  maxWidth: '900px',
                },
              },
            },
            {
              type: 'richText',
              name: 'requirements',
              label: 'Requirements',
              localized: true, // ✅ Локализовано
              editor: lexicalEditor({
                features: contentEditorFeatures,
              }),
              admin: {
                description: 'Requirements to obtain (localized)',
                style: {
                  maxWidth: '900px',
                },
              },
            },
            {
              type: 'richText',
              name: 'program',
              label: 'Program',
              localized: true, // ✅ Локализовано
              editor: lexicalEditor({
                features: contentEditorFeatures,
              }),
              admin: {
                description: 'Training program details (localized)',
                style: {
                  maxWidth: '900px',
                },
              },
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              type: 'group',
              name: 'seo',
              label: 'SEO Settings',
              fields: [
                {
                  type: 'text',
                  name: 'title',
                  label: 'SEO Title',
                  localized: true,
                  admin: {
                    description: 'Override default page title for search engines',
                  },
                },
                {
                  type: 'textarea',
                  name: 'meta_description',
                  label: 'Meta Description',
                  localized: true,
                  admin: {
                    description: 'Brief description for search results (150-160 characters)',
                  },
                },
                {
                  type: 'upload',
                  name: 'og_image',
                  label: 'OG Image',
                  relationTo: 'media',
                  admin: {
                    description: 'Image for social media sharing',
                  },
                },
                {
                  type: 'text',
                  name: 'focus_keyphrase',
                  label: 'Focus Keyphrase',
                  localized: true,
                  admin: {
                    description: 'Main SEO keyword/phrase',
                  },
                },
                {
                  type: 'text',
                  name: 'link_keywords',
                  label: 'Link Keywords',
                  localized: true,
                  admin: {
                    description: 'Comma-separated keywords for internal linking',
                  },
                },
                {
                  type: 'checkbox',
                  name: 'no_index',
                  label: 'No Index',
                  defaultValue: false,
                  admin: {
                    description: 'Prevent search engines from indexing this page',
                  },
                },
                {
                  type: 'checkbox',
                  name: 'no_follow',
                  label: 'No Follow',
                  defaultValue: false,
                  admin: {
                    description: 'Prevent search engines from following links on this page',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
