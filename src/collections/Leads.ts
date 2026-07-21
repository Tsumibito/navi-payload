import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

export const Leads: CollectionConfig = {
  slug: 'leads',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'kind', 'status', 'locale', 'createdAt'],
    group: 'Marketing',
  },
  access: {
    create: () => false,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    { name: 'email', type: 'email', required: true, index: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Newsletter subscriber', value: 'newsletter' },
        { label: 'Contact request', value: 'contact' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Subscribed', value: 'subscribed' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
    },
    { name: 'firstName', type: 'text' },
    { name: 'lastName', type: 'text' },
    { name: 'phone', type: 'text' },
    { name: 'message', type: 'textarea' },
    { name: 'locale', type: 'text' },
    { name: 'sourceUrl', type: 'text' },
    { name: 'utm', type: 'text' },
    { name: 'ip', type: 'text', admin: { readOnly: true } },
    { name: 'userAgent', type: 'textarea', admin: { readOnly: true } },
    { name: 'consentAt', type: 'date', required: true },
  ],
  timestamps: true,
}
