import type { Field } from 'payload'

export const createPublicSlugField = (): Field => ({
  type: 'text',
  name: 'publicSlug',
  label: 'Public Slug',
  required: false,
  unique: true,
  index: true,
  admin: {
    position: 'sidebar',
    description:
      'Frozen production URL slug. Non-localized and independent from translated editorial slugs.',
  },
})
