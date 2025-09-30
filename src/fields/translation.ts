import type { Field } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { createSeoField } from './seo';
import { contentEditorFeatures } from '../utils/lexicalConfig';

type TranslationFieldOptions = {
  includeSummary?: boolean;
  includeContent?: boolean;
  includeSlug?: boolean;
  slugRequired?: boolean;
  includeSeo?: boolean;
  includeSummaryGenerator?: boolean;
  includeSlugGenerator?: boolean;
  summaryGeneratorComponent?: string;
  extraFields?: Field[];
};

export const translationFields = (options: TranslationFieldOptions = {}): Field[] => {
  const {
    includeSummary = true,
    includeContent = true,
    includeSlug = true,
    slugRequired = true,
    includeSeo = true,
    includeSummaryGenerator = false,
    includeSlugGenerator = false,
    extraFields = [],
    summaryGeneratorComponent = '/src/components/GenerateSummaryButton#GenerateSummaryButton',
  } = options;

  const fields: Field[] = [
    {
      type: 'select',
      name: 'language',
      label: 'Language',
      required: true,
      options: [
        { label: 'Russian', value: 'ru' },
        { label: 'Ukrainian', value: 'ua' },
        { label: 'English', value: 'en' },
      ],
    },
    {
      type: 'text',
      name: 'name',
      label: 'Title',
    },
  ];

  if (includeSlug) {
    const slugField: Field = {
      type: 'text',
      name: 'slug',
      label: 'Slug',
      required: slugRequired,
    };

    if (includeSlugGenerator) {
      slugField.admin = {
        components: {
          afterInput: ['/src/components/GenerateSlugButton#GenerateSlugButton'],
        },
      };
    }

    fields.push(slugField);
  }

  if (includeSummaryGenerator) {
    fields.push({
      type: 'ui',
      name: 'summaryGenerator',
      admin: {
        components: {
          Field: '/src/components/GenerateSummaryButton#GenerateSummaryButton',
        },
      },
    });
  }

  if (includeSummary) {
    fields.push({
      type: 'textarea',
      name: 'summary',
      label: 'Summary',
      admin: includeSummaryGenerator
        ? {
            components: {
              afterInput: [summaryGeneratorComponent],
            },
          }
        : undefined,
    });
  }

  if (includeContent) {
    fields.push({
      type: 'richText',
      name: 'content',
      label: 'Content',
      editor: lexicalEditor({
        features: contentEditorFeatures,
      }),
      admin: {
        style: {
          maxWidth: '800px',
        },
      },
    });
  }

  if (extraFields.length) {
    fields.push(...extraFields);
  }

  if (includeSeo) {
    fields.push(createSeoField({ includeOverall: false }));
  }

  return fields;
};
