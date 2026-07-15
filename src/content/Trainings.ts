import type { CollectionConfig } from 'payload';

import { createSeoField } from '../fields/seo';
import { authenticated, publishedOrAuthenticated } from '../access/authenticated';

export const Trainings: CollectionConfig = {
  slug: 'trainings',
  dbName: 'trainings_new',
  labels: {
    singular: 'Training',
    plural: 'Trainings',
  },
  versions: {
    drafts: {
      autosave: {
        interval: 2000,
      },
    },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', '_status'],
    group: 'Content',
  },
  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
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
                description: 'Training name (localized)',
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
