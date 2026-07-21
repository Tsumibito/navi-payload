import type { Access } from 'payload';

import { env } from '../config/env';

export const authenticated: Access = ({ req }) => Boolean(req.user);

export const publishedOrAuthenticated: Access = ({ req }) => {
  if (req.user) return true;

  return {
    _status: {
      equals: 'published',
    },
  };
};

export const ssgOrAuthenticated: Access = ({ req }) => {
  if (req.user) return true;

  const suppliedKey = req.headers.get('x-navi-ssg-key');
  return Boolean(suppliedKey && suppliedKey === env.ssgApiKey);
};

export const ssgPublishedOrAuthenticated: Access = ({ req }) => {
  if (req.user) return true;

  const suppliedKey = req.headers.get('x-navi-ssg-key');
  if (!suppliedKey || suppliedKey !== env.ssgApiKey) return false;

  return {
    _status: {
      equals: 'published',
    },
  };
};

export const ssgPublishedGlossaryOrAuthenticated: Access = ({ req }) => {
  if (req.user) return true;

  const suppliedKey = req.headers.get('x-navi-ssg-key');
  if (!suppliedKey || suppliedKey !== env.ssgApiKey) return false;

  return {
    status: { equals: 'approved' },
    release: { equals: 'published' },
  };
};
