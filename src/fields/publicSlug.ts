import { APIError, type CollectionBeforeChangeHook, type Field } from 'payload'

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

export const createRouteLockedField = (): Field => ({
  type: 'checkbox',
  name: 'routeLocked',
  label: 'Production URL locked',
  defaultValue: true,
  required: true,
  admin: {
    position: 'sidebar',
    description:
      'Keep enabled after publication. Disable and save before an approved URL migration with redirects.',
  },
})

export const enforcePublicRouteLock: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (!originalDoc?.publicSlug || originalDoc.routeLocked === false) return data
  if (data?.publicSlug === undefined || data.publicSlug === originalDoc.publicSlug) return data
  if (data.routeLocked === false) return data

  throw new APIError(
    'Production URL is locked. Disable “Production URL locked” and save before changing Public Slug.',
    400,
  )
}
