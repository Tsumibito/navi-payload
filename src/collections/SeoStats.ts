import type { CollectionConfig } from 'payload';

export const SeoStats: CollectionConfig = {
  slug: 'seo-stats',
  labels: {
    singular: 'SEO Stats',
    plural: 'SEO Stats',
  },
  admin: {
    hidden: true, // Скрываем из меню - доступ только через API
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      type: 'text',
      name: 'entity_type',
      label: 'Entity Type',
      required: true,
      index: true,
      admin: {
        description: 'Type of entity (posts, tags, team, etc.)',
      },
    },
    {
      type: 'text',
      name: 'entity_id',
      label: 'Entity ID',
      required: true,
      index: true,
      admin: {
        description: 'ID of the entity',
      },
    },
    {
      type: 'text',
      name: 'focus_keyphrase',
      label: 'Focus Keyphrase',
      required: true,
    },
    {
      type: 'json',
      name: 'stats',
      label: 'Stats',
      required: true,
      admin: {
        description: 'SEO statistics data',
      },
    },
    {
      type: 'date',
      name: 'calculated_at',
      label: 'Calculated At',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
};
