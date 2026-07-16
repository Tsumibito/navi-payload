import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { authenticated } from '../access/authenticated'
import { createSeoField } from '../fields/seo'
import { createPublicSlugField } from '../fields/publicSlug'
import { contentEditorFeatures } from '../utils/lexicalConfig'

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: {
    singular: 'Page',
    plural: 'Pages',
  },
  admin: {
    useAsTitle: 'pageKey',
    defaultColumns: ['pageKey', 'pageType', 'publicSlug', '_status'],
    description: 'Static and listing-page content with frozen production routes',
    group: 'Content',
  },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      type: 'text',
      name: 'pageKey',
      label: 'Page Key',
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Stable routing identifier shared by all locales.',
      },
    },
    {
      type: 'select',
      name: 'pageType',
      label: 'Page Type',
      required: true,
      defaultValue: 'static',
      options: [
        { label: 'Root', value: 'root' },
        { label: 'Listing', value: 'listing' },
        { label: 'Static', value: 'static' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    createPublicSlugField(),
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              type: 'text',
              name: 'h1',
              label: 'H1',
              localized: true,
            },
            {
              type: 'richText',
              name: 'content',
              label: 'Content',
              localized: true,
              editor: lexicalEditor({
                features: contentEditorFeatures,
              }),
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
}
