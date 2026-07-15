import type { CollectionConfig } from 'payload';

import { authenticated, publishedOrAuthenticated } from '../access/authenticated';

export const TrainingsNew: CollectionConfig = {
  slug: 'trainings-new',
  labels: {
    singular: 'Training (New)',
    plural: 'Trainings (New)',
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
      type: 'text',
      name: 'name',
      label: 'Name',
      required: true,
      localized: true, // ✅ Локализовано
      admin: {
        description: 'Training name (localized)',
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
  ],
};
