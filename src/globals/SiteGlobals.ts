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
  ],
};
