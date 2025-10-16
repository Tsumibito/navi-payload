import type { CollectionConfig, CollectionSlug } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { translationFields } from '../fields/translation';
import { simpleEditorFeatures } from '../utils/lexicalConfig';

const POSTS_RELATION = 'posts' as unknown as CollectionSlug;
const CERTIFICATES_RELATION = 'certificates' as unknown as CollectionSlug;
const TRAININGS_RELATION = 'trainings' as unknown as CollectionSlug;
const FAQS_RELATION = 'faqs' as unknown as CollectionSlug;

export const Team: CollectionConfig = {
  slug: 'team',
  labels: {
    singular: 'Team Member',
    plural: 'Team Members',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'position'],
  },
  fields: [
    {
      type: 'text',
      name: 'name',
      label: 'Name',
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
      name: 'photo',
      label: 'Photo',
      relationTo: 'media',
    },
    {
      type: 'text',
      name: 'position',
      label: 'Position',
    },
    {
      type: 'richText',
      name: 'bioSummary',
      label: 'Bio Summary',
      editor: lexicalEditor({
        features: simpleEditorFeatures,
      }),
    },
    {
      type: 'richText',
      name: 'bio',
      label: 'Bio',
      editor: lexicalEditor({
        features: simpleEditorFeatures,
      }),
    },
    {
      type: 'array',
      name: 'links',
      label: 'Social Links',
      fields: [
        {
          type: 'select',
          name: 'service',
          label: 'Service',
          options: [
            { label: 'Email', value: 'email' },
            { label: 'Phone', value: 'phone' },
            { label: 'Twitter/X', value: 'x' },
            { label: 'Facebook', value: 'facebook' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'LinkedIn', value: 'linkedin' },
            { label: 'Website', value: 'website' },
          ],
        },
        {
          type: 'text',
          name: 'url',
          label: 'URL/Contact',
        },
      ],
    },
    {
      type: 'relationship',
      name: 'posts',
      label: 'Posts',
      relationTo: [POSTS_RELATION],
      hasMany: true,
    },
    {
      type: 'relationship',
      name: 'certificates',
      label: 'Certificates',
      relationTo: [CERTIFICATES_RELATION],
      hasMany: true,
    },
    {
      type: 'relationship',
      name: 'trainings',
      label: 'Trainings',
      relationTo: [TRAININGS_RELATION],
      hasMany: true,
    },
    {
      type: 'relationship',
      name: 'faqs',
      label: 'FAQs',
      relationTo: [FAQS_RELATION],
      hasMany: true,
    },
    {
      type: 'array',
      name: 'translations',
      label: 'Translations',
      fields: translationFields({
        includeSlug: false,
        extraFields: [
          {
            type: 'text',
            name: 'position',
            label: 'Position',
          },
          {
            type: 'richText',
            name: 'bioSummary',
            label: 'Bio Summary',
            editor: lexicalEditor({
              features: ({ defaultFeatures }) => defaultFeatures,
            }),
          },
          {
            type: 'richText',
            name: 'bio',
            label: 'Bio',
            editor: lexicalEditor({
              features: ({ defaultFeatures }) => defaultFeatures,
            }),
          },
        ],
      }),
    },

    //     createSeoField(),
  ],
};
