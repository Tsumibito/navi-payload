import type { CollectionConfig, CollectionSlug } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { contentEditorFeatures } from '../utils/lexicalConfig';
import { createSeoField } from '../fields/seo';

const POSTS_RELATION = 'posts-new' as unknown as CollectionSlug;

const dedupeRelationField = <T>(items: T[]): T[] => {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (item === null || item === undefined) {
      continue;
    }

    let key: string;

    if (typeof item === 'object') {
      const maybeRelation = item as { relationTo?: string; value?: unknown; id?: unknown };
      const identifier = maybeRelation.value ?? maybeRelation.id ?? JSON.stringify(item);
      key = `${maybeRelation.relationTo ?? ''}:${String(identifier)}`;
    } else {
      key = String(item);
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
};

export const Tags: CollectionConfig = {
  slug: 'tags-new',
  labels: {
    singular: 'Tag',
    plural: 'Tags',
  },
  versions: false,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
    description: 'Localized tags managed via native Payload i18n',
    group: 'Content',
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data) {
          return data;
        }

        let changed = false;
        let nextData = data;

        if (Array.isArray(data.posts)) {
          const dedupedPosts = dedupeRelationField(data.posts);
          if (dedupedPosts.length !== data.posts.length) {
            nextData = {
              ...nextData,
              posts: dedupedPosts,
            };
            changed = true;
          }
        }

        return changed ? nextData : data;
      },
    ],
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
              localized: true, // ✅ Нативная локализация
              admin: {
                description: 'Tag display name (localized)',
              },
            },
            {
              type: 'text',
              name: 'slug',
              label: 'Slug',
              required: true,
              unique: true,
              localized: true, // ✅ Нативная локализация
              admin: {
                description: 'Tag URL slug (localized)',
                components: {
                  afterInput: ['/src/components/GenerateSlugButton#GenerateSlugButton'],
                },
              },
            },
            {
              type: 'upload',
              name: 'image',
              label: 'Featured image',
              relationTo: 'media',
              // НЕ локализовано - общее для всех языков
            },
            {
              type: 'textarea',
              name: 'summary',
              label: 'Summary',
              localized: true, // ✅ Нативная локализация
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
              localized: true, // ✅ Нативная локализация
              editor: lexicalEditor({
                features: contentEditorFeatures,
              }),
              admin: {
                description: 'Main copy for the tag page (localized)',
                style: {
                  maxWidth: '800px',
                },
              },
            },
            {
              type: 'relationship',
              name: 'posts',
              label: 'Posts',
              relationTo: POSTS_RELATION,
              hasMany: true,
              // НЕ локализовано - связи общие
              admin: {
                description: 'Attach relevant posts',
              },
            },
          ],
        },
        {
          label: 'Technical',
          fields: [
            {
              type: 'textarea',
              name: 'descriptionForAI',
              label: 'Description for AI',
              localized: true, // ✅ Может быть разным для языков
              admin: {
                description: 'Optional hints for AI assistants (localized)',
              },
            },
            {
              type: 'group',
              name: 'socialImages',
              label: 'Social images',
              admin: {
                description: 'Optional artwork for different aspect ratios',
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
        {
          label: 'SEO',
          fields: [createSeoField({ localized: true })],
        },
      ],
    },
  ],
};
