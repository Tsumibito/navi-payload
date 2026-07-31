import type { Access } from 'payload';

import { env } from '../config/env';

const roleOf = (user: unknown): string => {
  if (!user || typeof user !== 'object') return ''
  return String((user as { role?: unknown }).role || 'admin')
}

// Existing human users predate roles and are treated as admins. Automation
// accounts are denied by default and must be opted in per collection/action.
export const authenticated: Access = ({ req }) => Boolean(req.user && roleOf(req.user) !== 'automation');
export const adminOnly: Access = ({ req }) => Boolean(req.user && roleOf(req.user) === 'admin');
export const contentEditor: Access = ({ req }) => Boolean(req.user && ['admin', 'editor', 'automation'].includes(roleOf(req.user)));

export const publishedOrAuthenticated: Access = ({ req }) => {
  if (req.user && roleOf(req.user) !== 'automation') return true;

  return {
    _status: {
      equals: 'published',
    },
  };
};

export const ssgOrAuthenticated: Access = ({ req }) => {
  // Authenticated automation may read drafts and every locale for preflight.
  if (req.user) return true;

  const suppliedKey = req.headers.get('x-navi-ssg-key');
  return Boolean(suppliedKey && suppliedKey === env.ssgApiKey);
};

export const ssgPublishedOrAuthenticated: Access = ({ req }) => {
  if (req.user && roleOf(req.user) !== 'automation') return true;

  const suppliedKey = req.headers.get('x-navi-ssg-key');
  if (!suppliedKey || suppliedKey !== env.ssgApiKey) return false;

  return {
    _status: {
      equals: 'published',
    },
  };
};

export const ssgPublishedGlossaryOrAuthenticated: Access = ({ req }) => {
  if (req.user && roleOf(req.user) !== 'automation') return true;

  const suppliedKey = req.headers.get('x-navi-ssg-key');
  if (!suppliedKey || suppliedKey !== env.ssgApiKey) return false;

  return {
    status: { equals: 'approved' },
    release: { equals: 'published' },
  };
};
