import type { CollectionConfig } from 'payload';

import { createSeoField } from '../fields/seo';

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
