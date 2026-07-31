import type { CollectionConfig } from 'payload'

import { adminOnly } from '../access/authenticated'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    tokenExpiration: 7 * 24 * 60 * 60,
    useAPIKey: true,
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'admin',
      saveToJWT: true,
      options: [
        { label: 'Administrator', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Automation', value: 'automation' },
      ],
    },
  ],
}
