import type { CollectionConfig, CollectionSlug } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { createSeoField } from '../fields/seo';
import { translationFields } from '../fields/translation';
import { contentEditorFeatures } from '../utils/lexicalConfig';

const TEAM_RELATION = 'team' as unknown as CollectionSlug;
const TAGS_RELATION = 'tags' as unknown as CollectionSlug;
const FAQS_RELATION = 'faqs' as unknown as CollectionSlug;

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: {
    singular: 'Post',
    plural: 'Posts',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'publishedAt', '_status'],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 2000,
      },
    },
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
              required: true,
              admin: {
                description: 'Primary post title',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  type: 'text',
                  name: 'slug',
                  label: 'Slug',
                  required: true,
                  unique: true,
                  admin: {
                    width: '70%',
                    description: 'Post URL slug',
                    components: {
                      afterInput: ['/src/components/GenerateSlugButton#GenerateSlugButton'],
                    },
                  },
                },
                {
                  type: 'date',
                  name: 'publishedAt',
                  label: 'Published at',
                  admin: {
                    width: '30%',
                  },
                },
              ],
            },
            {
              type: 'relationship',
              name: 'author',
              label: 'Author',
              relationTo: [TEAM_RELATION],
              admin: {
                description: 'Link post to a team member',
              },
            },
            {
              type: 'upload',
              name: 'image',
              label: 'Featured image',
              relationTo: 'media',
            },
            {
              type: 'textarea',
              name: 'summary',
              label: 'Summary',
              admin: {
                description: '2–3 sentence summary for listings',
                components: {
                  afterInput: ['/src/components/GenerateSummaryButton#GenerateSummaryButton'],
                },
              },
            },
            {
              type: 'richText',
              name: 'content',
              label: 'Content',
              editor: lexicalEditor({
                features: contentEditorFeatures,
              }),
              admin: {
                description: 'Main body of the post',
                style: {
                  maxWidth: '800px',
                },
              },
            },
            {
              type: 'relationship',
              name: 'tags',
              label: 'Tags',
              relationTo: [TAGS_RELATION],
              hasMany: true,
              admin: {
                description: 'Attach tags for categorization',
              },
            },
            {
              type: 'relationship',
              name: 'faqs',
              label: 'FAQ entries',
              relationTo: [FAQS_RELATION],
              hasMany: true,
            },
            {
              type: 'checkbox',
              name: 'featured',
              label: 'Featured post',
              defaultValue: false,
            },
            {
              type: 'collapsible',
              label: 'Social images',
              admin: {
                initCollapsed: true,
              },
              fields: [
                {
                  type: 'group',
                  name: 'socialImages',
                  label: 'Images',
                  admin: {
                    description: 'Optional artwork for various aspect ratios',
                  },
                  fields: [
                    {
                      type: 'upload',
                      name: 'thumbnail',
                      label: 'Thumbnail',
                      relationTo: 'media',
                    },
                    {
                      type: 'upload',
                      name: 'image16x9',
                      label: 'Image 16:9',
                      relationTo: 'media',
                    },
                    {
                      type: 'upload',
                      name: 'image5x4',
                      label: 'Image 5:4',
                      relationTo: 'media',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [createSeoField()],
        },
        {
          label: 'Translations',
          fields: [
            {
              type: 'array',
              name: 'translations',
              label: 'Translations',
              admin: {
                description: 'Localized versions of the post',
                initCollapsed: true,
              },
              fields: translationFields({
                includeSummaryGenerator: true,
                includeSlugGenerator: true,
              }),
            },
          ],
        },
      ],
    },
  ],
};
