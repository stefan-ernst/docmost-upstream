import { IntegrationManifest } from '../integration-oauth/manifest.types';
import { WINDSHIFT_RESOURCES } from './windshift.resources';

/**
 * One windshift host per docmost deployment (WINDSHIFT_BASE_URL).
 *
 * The redirect URI registered in windshift's oauth_clients row must equal
 * `${APP_URL}/api/integrations/oauth/windshift/callback`.
 */
export const WINDSHIFT_MANIFEST: IntegrationManifest = {
  id: 'windshift',
  name: 'Windshift',
  description: 'Embed live windshift items and collection reports in docmost pages.',
  baseUrl: () => process.env.WINDSHIFT_BASE_URL ?? '',
  authorizePath: '/oauth/authorize',
  tokenPath: '/api/oauth/token',
  userinfoPath: '/api/oauth/userinfo',
  userinfoEmailField: 'email',
  scopes: ['items:read', 'workspaces:read', 'collections:read'],
  scopeSeparator: ' ',
  pkce: true,
  clientIdEnv: 'WINDSHIFT_OAUTH_CLIENT_ID',
  clientSecretEnv: 'WINDSHIFT_OAUTH_CLIENT_SECRET',
  resources: WINDSHIFT_RESOURCES,
};
