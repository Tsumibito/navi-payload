import type { Access, CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { env } from '../config/env'
import { createPublicSlugField, createRouteLockedField, enforcePublicRouteLock } from '../fields/publicSlug'

const publishedOrSsg: Access = ({ req }) => {
  if (req.user) return true
  const key = req.headers.get('x-navi-ssg-key')
  if (!key || key !== env.ssgApiKey) return false
  return { status: { equals: 'published' } }
}

export const GeographyPages: CollectionConfig = {
  slug: 'geography-pages',
  labels: { singular: 'Geography page', plural: 'Geography pages' },
  admin: {
    useAsTitle: 'entityId',
    defaultColumns: ['entityId', 'entityFamily', 'status', 'publicSlug'],
    description: 'Editorial layer for verified importer-owned geography entities.',
    group: 'Charter',
  },
  access: { read: publishedOrSsg, create: authenticated, update: authenticated, delete: authenticated },
  hooks: { beforeChange: [enforcePublicRouteLock] },
  fields: [
    { type: 'text', name: 'entityId', required: true, unique: true, index: true, admin: { readOnly: true, position: 'sidebar' } },
    { type: 'select', name: 'entityFamily', required: true, options: ['country', 'sailing_area', 'region', 'island', 'locality', 'marina'], admin: { readOnly: true, position: 'sidebar' } },
    createPublicSlugField(), createRouteLockedField(),
    { type: 'select', name: 'status', required: true, defaultValue: 'inventory', options: ['inventory', 'draft', 'review', 'published', 'retired'], index: true, admin: { position: 'sidebar' } },
    { type: 'json', name: 'localizedContent', label: 'Localized editorial content (ru/ua/en)', required: true },
    { type: 'json', name: 'localizedSeo', label: 'Localized SEO (ru/ua/en)' },
    { type: 'json', name: 'heroMedia', label: 'Hero media and licence' },
    { type: 'json', name: 'landingCard', label: 'Charter landing card' },
    { type: 'checkbox', name: 'showOnCharterLanding', defaultValue: false },
    { type: 'number', name: 'landingOrder', defaultValue: 100 },
    { type: 'json', name: 'systemProjection', label: 'Verified importer projection', admin: { readOnly: true } },
    { type: 'text', name: 'projectionHash', required: true, index: true, admin: { readOnly: true } },
    { type: 'json', name: 'editorialApproval', label: 'Human editorial approval' },
  ],
}
