import type { Access, CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { env } from '../config/env'
import { createPublicSlugField, createRouteLockedField, enforcePublicRouteLock } from '../fields/publicSlug'

const publishedOrSsg: Access = ({ req }) => {
  if (req.user) return true
  if (req.headers.get('x-navi-ssg-key') !== env.ssgApiKey) return false
  return { status: { equals: 'published' } }
}

export const SailingRoutes: CollectionConfig = {
  slug: 'sailing-routes',
  labels: { singular: 'Sailing route', plural: 'Sailing routes' },
  admin: { useAsTitle: 'routeId', defaultColumns: ['routeId', 'status', 'publicSlug'], group: 'Charter' },
  access: { read: publishedOrSsg, create: authenticated, update: authenticated, delete: authenticated },
  hooks: { beforeChange: [enforcePublicRouteLock] },
  fields: [
    { type: 'text', name: 'routeId', required: true, unique: true, index: true, admin: { readOnly: true, position: 'sidebar' } },
    createPublicSlugField(), createRouteLockedField(),
    { type: 'select', name: 'status', required: true, defaultValue: 'draft', options: ['draft', 'review', 'published', 'retired'], index: true, admin: { position: 'sidebar' } },
    { type: 'relationship', name: 'region', relationTo: 'geography-pages', required: true },
    { type: 'relationship', name: 'departureMarina', relationTo: 'geography-pages', required: true },
    { type: 'json', name: 'localizedContent', label: 'Localized route content (ru/ua/en)', required: true },
    { type: 'json', name: 'localizedSeo', label: 'Localized SEO (ru/ua/en)' },
    { type: 'json', name: 'heroMedia', label: 'Hero media and licence' },
    { type: 'json', name: 'systemProjection', label: 'Verified geometry and provenance', admin: { readOnly: true } },
    { type: 'text', name: 'projectionHash', required: true, index: true, admin: { readOnly: true } },
    { type: 'json', name: 'editorialApproval', label: 'Human editorial approval' },
  ],
}
