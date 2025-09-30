import type { CollectionConfig, CollectionSlug } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { createSeoField } from '../fields/seo';
import { translationFields } from '../fields/translation';

const TAGS_RELATION = 'tags' as unknown as CollectionSlug;
const POSTS_RELATION = 'posts' as unknown as CollectionSlug;

export const Faqs: CollectionConfig = {
  slug: 'faqs',
  labels: {
    singular: 'FAQ',
    plural: 'FAQs',
  },
  admin: {
    useAsTitle: 'question',
    defaultColumns: ['question'],
  },
  fields: [
    {
      type: 'text',
      name: 'question',
      label: 'Question',
      required: true,
    },
    {
      type: 'richText',
      name: 'answer',
      label: 'Answer',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => defaultFeatures,
      }),
    },
    {
      type: 'relationship',
      name: 'tags',
      label: 'Tags',
      relationTo: [TAGS_RELATION],
      hasMany: true,
    },
    {
      type: 'relationship',
      name: 'posts',
      label: 'Posts',
      relationTo: [POSTS_RELATION],
      hasMany: true,
    },
    {
      type: 'array',
      name: 'translations',
      label: 'Translations',
      fields: translationFields({
        extraFields: [
          {
            type: 'richText',
            name: 'answer',
            label: 'Answer',
            editor: lexicalEditor({
              features: ({ defaultFeatures }) => defaultFeatures,
            }),
          },
        ],
      }),
    },
    createSeoField(),
  ],
};
