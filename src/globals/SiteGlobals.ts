import type { GlobalConfig } from 'payload';

export const SiteGlobals: GlobalConfig = {
  slug: 'site-globals',
  label: 'Site Globals',
  fields: [
    {
      type: 'text',
      name: 'title',
      label: 'Title',
      required: true,
    },
    {
      type: 'text',
      name: 'tagline',
      label: 'Tagline',
    },
    {
      type: 'textarea',
      name: 'description',
      label: 'Description',
    },
    {
      type: 'text',
      name: 'url',
      label: 'Website URL',
    },
    {
      type: 'upload',
      name: 'favicon',
      label: 'Favicon',
      relationTo: 'media',
    },
    {
      type: 'upload',
      name: 'logo',
      label: 'Logo',
      relationTo: 'media',
    },
    {
      type: 'upload',
      name: 'logoDarkMode',
      label: 'Logo (Dark Mode)',
      relationTo: 'media',
    },
    {
      type: 'text',
      name: 'accentColor',
      label: 'Accent Color',
    },
    {
      type: 'array',
      name: 'socialLinks',
      label: 'Social Links',
      fields: [
        {
          type: 'text',
          name: 'service',
          label: 'Service',
        },
        {
          type: 'text',
          name: 'url',
          label: 'URL',
        },
      ],
    },
    {
      type: 'array',
      name: 'availableLanguages',
      label: 'Available Languages',
      admin: {
        description: 'Управление языками сайта',
      },
      fields: [
        {
          type: 'text',
          name: 'code',
          label: 'Code',
          required: true,
          admin: {
            description: 'ISO код языка (ru, uk, en, pl, fr, es, de)',
          },
        },
        {
          type: 'text',
          name: 'name',
          label: 'Name',
          required: true,
          admin: {
            description: 'Название языка',
          },
        },
        {
          type: 'text',
          name: 'flag',
          label: 'Flag Emoji',
          admin: {
            description: 'Флаг для отображения (например 🇷🇺)',
          },
        },
        {
          type: 'checkbox',
          name: 'enabled',
          label: 'Enabled',
          defaultValue: true,
        },
        {
          type: 'checkbox',
          name: 'isDefault',
          label: 'Default Language',
          defaultValue: false,
        },
      ],
      defaultValue: [
        { code: 'ru', name: 'Русский', flag: '🇷🇺', enabled: true, isDefault: true },
        { code: 'uk', name: 'Українська', flag: '🇺🇦', enabled: true, isDefault: false },
        { code: 'en', name: 'English', flag: '🇬🇧', enabled: true, isDefault: false },
      ],
    },
  ],
};
