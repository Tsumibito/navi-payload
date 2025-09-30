import type { Field } from 'payload';

type SeoFieldOptions = {
  includeOverall?: boolean;
};

export const createSeoField = ({ includeOverall = true }: SeoFieldOptions = {}): Field => {
  const fields: Field[] = [];

  if (includeOverall) {
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
      admin: {
        description: 'Желательно до 60 символов',
      },
    },
    {
      type: 'textarea',
      name: 'meta_description',
      label: 'Meta Description',
      admin: {
        description: 'Желательно до 160 символов',
      },
    },
    {
      type: 'upload',
      name: 'og_image',
      label: 'Open Graph Image',
      relationTo: 'media',
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
    },
    {
      type: 'text',
      name: 'focus_keyphrase',
      label: 'Focus Keyphrase',
    }
  );

  fields.push({
    type: 'json',
    name: 'additional_fields',
    label: 'Additional Fields',
    admin: {
      description: 'Arbitrary extra SEO data (e.g., link keywords).',
    },
  } as Field);

  return {
    type: 'group',
    name: 'seo',
    label: 'SEO',
    fields,
  };
};
