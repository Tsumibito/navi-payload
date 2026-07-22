import type { CollectionConfig, CollectionSlug } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { contentEditorFeatures, simpleEditorFeatures } from '../utils/lexicalConfig';
import { createSeoField } from '../fields/seo';
import { authenticated, ssgOrAuthenticated } from '../access/authenticated';
import { createPublicSlugField } from '../fields/publicSlug';
import { CONTENT_LOCALES } from '../config/contentLocales';

const TEAM_RELATION = 'team-new' as unknown as CollectionSlug;
const TAGS_RELATION = 'tags-new' as unknown as CollectionSlug;

export const Posts: CollectionConfig = {
  slug: 'posts-new',
  labels: {
    singular: 'Post',
    plural: 'Posts',
  },
  versions: false,
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'published_at', 'featured'],
    description: 'Blog posts with native Payload i18n',
    group: 'Content',
  },
  access: {
    read: ssgOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data || !Array.isArray((data as { tags?: unknown }).tags)) {
          return data;
        }

        const nextTags = ((data as { tags?: unknown }).tags as unknown[]).filter((tag) => Boolean(tag));

        if (nextTags.length === ((data as { tags?: unknown }).tags as unknown[]).length) {
          return data;
        }

        return {
          ...data,
          tags: nextTags,
        };
      },
    ],
    afterChange: [
      async ({ context, doc, previousDoc, req }) => {
        if (context.skipLocalizationWorkflow || !doc.localizationWorkflow?.autoRun) return doc;
        const sourceLocale = doc.localizationWorkflow.sourceLocale || req.locale || 'ru';
        const targetLocales = doc.localizationWorkflow.targetLocales?.length
          ? doc.localizationWorkflow.targetLocales
          : CONTENT_LOCALES.map(({ code }) => code);
        const watchedFields = ['name', 'content', 'summary', 'image', 'faqs', 'authors', 'tags', 'publicationStatus'] as const;
        const imageRequested = Boolean(doc.localizationWorkflow?.imagePrompt) && (
          !doc.image || doc.localizationWorkflow?.regenerateImage ||
          doc.localizationWorkflow?.imagePrompt !== previousDoc?.localizationWorkflow?.imagePrompt
        );
        const changedFields = !previousDoc || !previousDoc.localizationWorkflow?.autoRun
          ? [...watchedFields]
          : watchedFields.filter((field) => JSON.stringify(doc[field]) !== JSON.stringify(previousDoc[field]));
        if (imageRequested && !changedFields.includes('image')) changedFields.push('image');
        if (!changedFields.length) return doc;
        await req.payload.jobs.queue({
          task: 'localize-post' as never,
          queue: 'content-localization',
          input: { postId: doc.id, sourceLocale, targetLocales, changedFields } as never,
        });
        await req.payload.update({
          collection: 'posts-new', id: doc.id, locale: sourceLocale,
          context: { skipLocalizationWorkflow: true },
          data: {
            publicationStatus: doc.publicationStatus === 'published' ? 'published' : 'localizing',
            localizationWorkflow: { ...doc.localizationWorkflow, state: 'queued', lastError: null },
          },
        });
        // The long-running cron runner used to poll Postgres every minute and
        // prevented Neon from scaling to zero. Run the queue only after an
        // editor action has actually enqueued work.
        void req.payload.jobs.run({ queue: 'content-localization', limit: 1 }).catch((error) => {
          req.payload.logger.error({ err: error }, 'On-demand localization worker failed');
        });
        return doc;
      },
    ],
  },
  fields: [
    createPublicSlugField(),
    {
      type: 'select',
      name: 'publicationStatus',
      label: 'Publication status',
      defaultValue: 'draft',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Localization in progress', value: 'localizing' },
        { label: 'Editorial review', value: 'review' },
        { label: 'Ready to publish', value: 'ready' },
        { label: 'Published', value: 'published' },
      ],
      admin: { position: 'sidebar', description: 'Publishing is separate from saving. AI jobs never publish automatically.' },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Localization workflow',
          fields: [
            { type: 'ui', name: 'runEditorialWorkflow', admin: { components: { Field: '/src/components/EditorialWorkflowButton#EditorialWorkflowButton' } } },
            {
              type: 'group', name: 'localizationWorkflow', label: 'Automated localization', fields: [
                { type: 'select', name: 'sourceLocale', label: 'Language this article was written in', required: true, defaultValue: 'ru', options: CONTENT_LOCALES.map(({ code, label }) => ({ value: code, label })) },
                { type: 'select', name: 'targetLocales', label: 'Languages to maintain', hasMany: true, defaultValue: CONTENT_LOCALES.map(({ code }) => code), options: CONTENT_LOCALES.map(({ code, label }) => ({ value: code, label })) },
                { type: 'checkbox', name: 'autoRun', label: 'Regenerate missing/outdated localized fields after save', defaultValue: false },
                { type: 'textarea', name: 'imagePrompt', label: 'Hero image prompt', admin: { description: 'Optional. Saving the post generates a 16:9 hero image when none exists. Enable regeneration to replace an existing image.' } },
                { type: 'checkbox', name: 'regenerateImage', label: 'Regenerate hero image on next workflow run', defaultValue: false },
                { type: 'text', name: 'generatedImageModel', label: 'Last image model', admin: { readOnly: true } },
                { type: 'date', name: 'lastImageGeneratedAt', label: 'Last image generation', admin: { readOnly: true } },
                { type: 'checkbox', name: 'regenerateSocialImages', label: 'Regenerate social images on next workflow run', defaultValue: false },
                { type: 'text', name: 'socialImageSourceLocale', label: 'Social image languages', admin: { readOnly: true } },
                { type: 'date', name: 'lastSocialImagesGeneratedAt', label: 'Last social image generation', admin: { readOnly: true } },
                { type: 'text', name: 'currentStage', label: 'Current workflow stage', admin: { readOnly: true } },
                { type: 'select', name: 'state', label: 'Workflow state', defaultValue: 'idle', admin: { readOnly: true }, options: ['idle', 'queued', 'running', 'review', 'failed'].map((value) => ({ label: value, value })) },
                { type: 'select', name: 'completedLocales', label: 'Completed locales', hasMany: true, admin: { readOnly: true }, options: CONTENT_LOCALES.map(({ code, label }) => ({ value: code, label })) },
                { type: 'date', name: 'lastCompletedAt', label: 'Last completed', admin: { readOnly: true } },
                { type: 'textarea', name: 'lastError', label: 'Last error', admin: { readOnly: true } },
                { type: 'json', name: 'linkPlan', label: 'Thematic internal-link plan', localized: true, admin: { readOnly: true, description: 'AI proposals: target, exact anchor, reason and section. Kept for editorial review before applying.' } },
                { type: 'json', name: 'inboundLinkPlan', label: 'Incoming internal-link plan', localized: true, admin: { readOnly: true, description: 'Published articles selected to link back to this article. Applied only after this article is published.' } },
              ],
            },
          ],
        },
        {
          label: 'Content',
          fields: [
            {
              type: 'text',
              name: 'name',
              label: 'Title',
              localized: true, // ✅ Локализовано
              admin: {
                description: 'Post title (localized)',
              },
            },
            {
              type: 'text',
              name: 'slug',
              label: 'Slug',
              required: true,
              localized: true, // ✅ Локализовано - зависит от языка
              admin: {
                description: 'URL-friendly identifier per language',
                components: {
                  afterInput: ['/src/components/GenerateSlugButton#GenerateSlugButton'],
                },
              },
            },
            {
              type: 'upload',
              name: 'image',
              label: 'Featured Image',
              relationTo: 'media',
              // НЕ локализовано - общее для всех языков
              admin: {
                description: 'Main post image',
              },
            },
            {
              type: 'text', name: 'imageAlt', label: 'Featured image alt text', localized: true,
              admin: { description: 'Generated per language, editable before publication.', components: { afterInput: ['/src/components/EditorialFieldActions#GenerateImageAltButton'] } },
            },
            {
              type: 'textarea',
              name: 'summary',
              label: 'Summary',
              localized: true, // ✅ Локализовано
              admin: {
                description: '1–2 sentence overview (localized)',
                components: {
                  afterInput: ['/src/components/GenerateSummaryButton#GenerateSummaryButton'],
                },
              },
            },
            {
              type: 'richText',
              name: 'content',
              label: 'Content',
              localized: true, // ✅ Локализовано
              editor: lexicalEditor({
                features: contentEditorFeatures,
              }),
              admin: {
                description: 'Main post content (localized)',
                style: {
                  maxWidth: '900px',
                },
              },
            },
            {
              type: 'relationship',
              name: 'authors',
              label: 'Authors',
              relationTo: [TEAM_RELATION],
              hasMany: true,
              // НЕ локализовано
              admin: {
                description: 'Select one or more team members as authors',
              },
            },
            {
              type: 'relationship',
              name: 'tags',
              label: 'Tags',
              relationTo: [TAGS_RELATION],
              hasMany: true,
              // НЕ локализовано
              admin: {
                description: 'Post tags',
                components: {
                  afterInput: ['/src/components/DefineTagsButton#DefineTagsButton'],
                },
              },
            },
            {
              type: 'checkbox',
              name: 'featured',
              label: 'Featured',
              defaultValue: false,
              // НЕ локализовано
              admin: {
                description: 'Mark as featured post',
              },
            },
          ],
        },
        {
          label: 'Social Images',
          fields: [
            { type: 'ui', name: 'generateSocialImages', admin: { components: { Field: '/src/components/EditorialFieldActions#GenerateSocialImagesButton' } } },
            {
              type: 'group',
              name: 'socialImages',
              label: 'Social Media Images',
              fields: [
                {
                  type: 'upload',
                  name: 'thumbnail',
                  label: 'Thumbnail',
                  relationTo: 'media',
                  localized: true,
                },
                {
                  type: 'upload',
                  name: 'image16x9',
                  label: 'Image 16:9',
                  relationTo: 'media',
                  localized: true,
                },
                {
                  type: 'upload',
                  name: 'image5x4',
                  label: 'Portrait Image 4:5',
                  relationTo: 'media',
                  localized: true,
                },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            { type: 'ui', name: 'generateSeoFields', admin: { components: { Field: '/src/components/EditorialFieldActions#GenerateSeoFieldsButton' } } },
            createSeoField({ localized: true, localizedImage: true }),
          ],
        },
        {
          label: 'FAQs',
          fields: [
            {
              type: 'ui',
              name: 'aiFaqGenerator',
              admin: {
                components: {
                  Field: '/src/components/EditorialFieldActions#GenerateFaqFieldsButton',
                },
              },
            },
            {
              type: 'array',
              name: 'faqs',
              label: 'Frequently Asked Questions',
              fields: [
                {
                  type: 'text',
                  name: 'question',
                  label: 'Question',
                  required: true,
                  localized: true, // ✅ Локализовано
                  admin: {
                    description: 'FAQ question (localized)',
                  },
                },
                {
                  type: 'richText',
                  name: 'answer',
                  label: 'Answer',
                  required: true,
                  localized: true, // ✅ Локализовано
                  editor: lexicalEditor({
                    features: simpleEditorFeatures,
                  }),
                  admin: {
                    description: 'FAQ answer (localized)',
                  },
                },
              ],
              admin: {
                initCollapsed: true,
                description: 'FAQ section for this post',
              },
            },
          ],
        },
      ],
    },
  ],
};
