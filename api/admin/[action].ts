import type { VercelRequest, VercelResponse } from '@vercel/node';
import grantTrial from '../_lib/admin/grant-trial.js';
import enterpriseRequests from '../_lib/admin/enterprise-requests.js';
import provisionEnterprise from '../_lib/admin/provision-enterprise.js';

/**
 * Single serverless function for all owner-only admin routes.
 *
 * Vercel Hobby caps a deployment at 12 functions; the three admin handlers
 * used to be separate files and pushed main to 15, which failed every
 * production deploy at "Deploying outputs". URLs are unchanged:
 *   /api/admin/grant-trial
 *   /api/admin/enterprise-requests
 *   /api/admin/provision-enterprise
 * Each handler still does its own JWT + owner-email check.
 */
const ROUTES: Record<string, (req: VercelRequest, res: VercelResponse) => unknown> = {
  'grant-trial': grantTrial,
  'enterprise-requests': enterpriseRequests,
  'provision-enterprise': provisionEnterprise,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  const route = action && Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : undefined;
  if (!route) {
    return res.status(404).json({ error: 'Not found' });
  }
  return route(req, res);
}
