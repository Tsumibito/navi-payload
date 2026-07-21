import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'

const normalizeLocale = (value: unknown) => String(value || '').trim().toLowerCase().replace('_', '-')

export const GlossaryTerms: CollectionConfig = {
  slug: 'glossary-terms',
  labels: { singular: 'Yachting term', plural: 'Yachting glossary' },
  admin: {
    useAsTitle: 'canonicalKey',
    defaultColumns: ['canonicalKey', 'domain', 'status', 'updatedAt'],
    group: 'Editorial intelligence',
    description: 'One sailing concept with any number of language variants. Approved variants are used by localization jobs.',
  },
  access: { read: authenticated, create: authenticated, update: authenticated, delete: authenticated },
  hooks: {
    beforeValidate: [({ data }) => {
      if (!data) return data
      const translations = Array.isArray(data.translations) ? data.translations : []
      const seen = new Set<string>()
      for (const translation of translations) {
        translation.locale = normalizeLocale(translation.locale)
        if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/.test(translation.locale)) throw new Error(`Invalid glossary locale: ${translation.locale}`)
        if (seen.has(translation.locale)) throw new Error(`Duplicate glossary locale: ${translation.locale}`)
        seen.add(translation.locale)
      }
      return { ...data, canonicalKey: String(data.canonicalKey || '').trim().toLowerCase(), translations }
    }],
  },
  fields: [
    { type: 'text', name: 'canonicalKey', label: 'Canonical concept key', required: true, unique: true, index: true, admin: { description: 'Stable language-neutral key, normally the preferred English term.' } },
    { type: 'select', name: 'domain', required: true, defaultValue: 'general', options: ['general', 'sailing', 'navigation', 'meteorology', 'safety', 'radio', 'rigging', 'boatbuilding', 'racing', 'charter', 'certification'].map((value) => ({ label: value, value })) },
    { type: 'select', name: 'status', required: true, defaultValue: 'proposed', options: ['proposed', 'approved', 'deprecated'].map((value) => ({ label: value, value })) },
    {
      type: 'array', name: 'translations', label: 'Language variants', required: true, minRows: 1,
      fields: [
        { type: 'text', name: 'locale', required: true, admin: { description: 'BCP-47 code: ru, uk, en, fr, es, de, pl, etc. Adding a language does not require a DB migration.' } },
        { type: 'text', name: 'term', required: true },
        { type: 'array', name: 'aliases', fields: [{ type: 'text', name: 'value', required: true }] },
        { type: 'textarea', name: 'definition' },
        { type: 'textarea', name: 'usageNotes', label: 'Usage and context' },
        { type: 'array', name: 'forbiddenVariants', label: 'Avoid these variants', fields: [{ type: 'text', name: 'value', required: true }] },
        { type: 'select', name: 'status', required: true, defaultValue: 'proposed', options: ['proposed', 'approved', 'rejected'].map((value) => ({ label: value, value })) },
        { type: 'select', name: 'provenance', required: true, defaultValue: 'agent', options: ['manual', 'article', 'txt-source', 'pdf-source', 'agent'].map((value) => ({ label: value, value })) },
        { type: 'number', name: 'confidence', min: 0, max: 1, defaultValue: 0.5 },
      ],
    },
    { type: 'relationship', name: 'evidencePosts', label: 'Articles containing this concept', relationTo: 'posts-new', hasMany: true },
    { type: 'textarea', name: 'editorNotes' },
  ],
}
