import type { CollectionConfig } from 'payload';

import { createSeoField } from '../fields/seo';
import { translationFields } from '../fields/translation';

export const Trainings: CollectionConfig = {
  slug: 'trainings',
  labels: {
    singular: 'Training',
    plural: 'Trainings',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug'],
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
      type: 'array',
      name: 'translations',
      label: 'Translations',
      fields: translationFields({ includeSummary: false, includeSeo: false }),
    },
    createSeoField(),
  ],
};
