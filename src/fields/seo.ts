import type { Field } from 'payload';

type SeoFieldOptions = {
  localized?: boolean;
  includeOverview?: boolean;
};

export const createSeoField = (
  { localized = false, includeOverview = false }: SeoFieldOptions = {}
): Field => {
  const localizedProps = localized ? { localized: true as const } : undefined;

  const fields: Field[] = [];

  if (includeOverview) {
    fields.push({
      type: 'text',
      name: 'overall_ui',
      label: 'SEO Overview',
      admin: {
        readOnly: true,
      },
    });
  }

  fields.push(
    {
      type: 'text',
      name: 'title',
      label: 'SEO Title',
      ...(localizedProps ?? {}),
      admin: {
        description: 'Оптимально 50–60 символов',
        components: {
          afterInput: ['/src/components/SeoLengthIndicator#SeoTitleLengthIndicator'],
        },
      },
    },
    {
      type: 'textarea',
      name: 'meta_description',
      label: 'Meta Description',
      ...(localizedProps ?? {}),
      admin: {
        description: 'Оптимально 140–160 символов',
        components: {
          afterInput: ['/src/components/SeoLengthIndicator#SeoMetaDescriptionLengthIndicator'],
        },
      },
    },
    {
      type: 'upload',
      name: 'og_image',
      label: 'Open Graph Image',
      relationTo: 'media',
      admin: {
        components: {
          afterField: '/src/components/OgImageActions#OgImageActions',
        },
      },
    } as Field,
    {
      type: 'text',
      name: 'focus_keyphrase',
      label: 'Focus Keyphrase',
      ...(localizedProps ?? {}),
      admin: {
        description: 'Основной поисковый запрос, по которому оптимизируется страница',
      },
    },
    {
      type: 'json',
      name: 'focus_keyphrase_stats',
      label: 'Focus Keyphrase Analysis',
      admin: {
        components: {
          Field: '/src/components/FocusKeyphraseAnalyzer#FocusKeyphraseAnalyzer',
        },
      },
    } as Field,
    {
      type: 'textarea',
      name: 'link_keywords',
      label: 'Link Keywords',
      ...(localizedProps ?? {}),
      admin: {
        hidden: true,
        description: 'Ключевые фразы и внутренние ссылки через запятую',
      },
    },
    {
      type: 'json',
      name: 'additional_fields',
      label: 'Additional Fields',
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      type: 'ui',
      name: 'link_keywords_ui',
      admin: {
        components: {
          Field: '/src/components/SeoKeywordManager#SeoKeywordManager',
        },
      },
    } as Field,
    {
      type: 'code',
      name: 'json_ld',
      label: 'JSON-LD',
      admin: {
        language: 'json',
        description: 'Структурированные данные Schema.org в формате JSON-LD. Будет автоматически обернут в <script type="application/ld+json">',
        className: 'json-ld-field',
      },
    },
    {
      type: 'checkbox',
      name: 'no_index',
      label: 'No Index',
      defaultValue: false,
    },
    {
      type: 'checkbox',
      name: 'no_follow',
      label: 'No Follow',
      defaultValue: false,
    }
  );

  return {
    type: 'group',
    name: 'seo',
    label: 'SEO',
    fields,
  };
};
