import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  labels: {
    singular: 'Subscriber',
    plural: 'Subscribers',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'status', 'locale', 'sourceUrl', 'createdAt'],
    group: 'Marketing',
    description: 'Email newsletter subscribers. Contact requests remain in Leads.',
  },
  access: {
    create: () => false,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'subscribed',
      index: true,
      options: [
        { label: 'Subscribed', value: 'subscribed' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
    },
    { name: 'firstName', type: 'text' },
    { name: 'lastName', type: 'text' },
    { name: 'locale', type: 'text' },
    { name: 'sourceUrl', type: 'text' },
    { name: 'utm', type: 'text' },
    { name: 'ip', type: 'text', admin: { readOnly: true } },
    { name: 'userAgent', type: 'textarea', admin: { readOnly: true } },
    { name: 'consentAt', type: 'date', required: true },
  ],
  timestamps: true,
}
