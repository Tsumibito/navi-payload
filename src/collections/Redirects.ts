import type { CollectionConfig } from 'payload';

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  labels: {
    singular: 'Redirect',
    plural: 'Redirects',
  },
  admin: {
    useAsTitle: 'fromPath',
    defaultColumns: ['fromPath', 'toPath', 'statusCode'],
  },
  fields: [
    {
      type: 'text',
      name: 'fromPath',
      label: 'From Path',
      required: true,
    },
    {
      type: 'text',
      name: 'toPath',
      label: 'To Path',
      required: true,
    },
    {
      type: 'number',
      name: 'statusCode',
      label: 'Status Code',
      required: true,
      defaultValue: 301,
      min: 100,
      max: 599,
    },
    {
      type: 'date',
      name: 'createdAtOverride',
      label: 'Created At',
      admin: {
        description: 'Optional override. Defaults to creation timestamp.',
      },
    },
  ],
};
