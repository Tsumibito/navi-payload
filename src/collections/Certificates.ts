import type { CollectionConfig } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { contentEditorFeatures } from '../utils/lexicalConfig';
import { createSeoField } from '../fields/seo';

export const Certificates: CollectionConfig = {
  slug: 'certificates',
  dbName: 'certificates_new',
  labels: {
    singular: 'Certificate',
    plural: 'Certificates',
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
              localized: true,
              admin: {
                description: 'Certificate name (localized)',
              },
            },
            {
              type: 'text',
              name: 'slug',
              label: 'Slug',
              required: true,
              localized: true,
              admin: {
                description: 'URL-friendly identifier per language',
                components: {
                  afterInput: ['/src/components/GenerateSlugButton#GenerateSlugButton'],
                },
              },
            },
            {
              type: 'upload',
              name: 'frontImage',
              label: 'Certificate Front Side',
              relationTo: 'media',
              admin: {
                description: 'Front side of the certificate',
              },
            },
            {
              type: 'upload',
              name: 'backImage',
              label: 'Certificate Back Side',
              relationTo: 'media',
              admin: {
                description: 'Back side of the certificate',
              },
            },
            {
              type: 'richText',
              name: 'description',
              label: 'Description',
              localized: true,
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
              localized: true,
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
              localized: true,
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
          fields: [createSeoField({ localized: true })],
        },
      ],
    },
  ],
};
