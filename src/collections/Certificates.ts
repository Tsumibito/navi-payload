import type { CollectionConfig } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { createSeoField } from '../fields/seo';
import { translationFields } from '../fields/translation';

export const Certificates: CollectionConfig = {
  slug: 'certificates',
  labels: {
    singular: 'Certificate',
    plural: 'Certificates',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug'],
  },
  fields: [
    {
      type: 'text',
      name: 'title',
      label: 'Title',
      required: true,
    },
    {
      type: 'text',
      name: 'slug',
      label: 'Slug',
      required: true,
      unique: true,
    },
    {
      type: 'upload',
      name: 'image',
      label: 'Certificate Image',
      relationTo: 'media',
    },
    {
      type: 'richText',
      name: 'description',
      label: 'Description',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => defaultFeatures,
      }),
    },
    {
      type: 'text',
      name: 'issuer',
      label: 'Issuer',
    },
    {
      type: 'date',
      name: 'issuedDate',
      label: 'Issued Date',
    },
    {
      type: 'date',
      name: 'expiryDate',
      label: 'Expiry Date',
    },
    {
      type: 'array',
      name: 'translations',
      label: 'Translations',
      fields: translationFields({
        includeSummary: false,
        extraFields: [
          {
            type: 'richText',
            name: 'description',
            label: 'Description',
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
