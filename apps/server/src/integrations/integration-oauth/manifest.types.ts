/**
 * OAuth + identity contract for a third-party integration. Each consumer
 * module declares one of these and registers it with IntegrationOAuthRegistry
 * at boot.
 */
import { IntegrationResourceManifest } from './resource.types';

export interface IntegrationManifest {
  /** Stable identifier — used in URLs, env vars, and the token table. */
  id: string;
  /** Display name for the settings UI. */
  name: string;
  description?: string;
  /** Provider base URL. A thunk lets env-driven values resolve at request time. */
  baseUrl: string | (() => string);
  /** e.g. /oauth/authorize */
  authorizePath: string;
  /** e.g. /api/oauth/token */
  tokenPath: string;
  userinfoPath?: string;
  userinfoEmailField?: string;
  scopes: string[];
  /** Defaults to ' '. Some providers use ','. */
  scopeSeparator?: string;
  /** Extra authorize-URL params (e.g. prompt=consent). */
  extraAuthParams?: Record<string, string>;
  /** PKCE S256. Required for public clients; recommended for confidential. */
  pkce?: boolean;
  /** Env var holding the OAuth client_id. */
  clientIdEnv: string;
  /** Env var holding the OAuth client_secret (omit for public clients). */
  clientSecretEnv?: string;
  icon?: string;
  /** Safe editor resources exposed through the generic integration surface. */
  resources?: IntegrationResourceManifest[];
}

/** Resolves IntegrationManifest.baseUrl whether it's a literal or a thunk. */
export function resolveBaseUrl(manifest: IntegrationManifest): string {
  const raw = typeof manifest.baseUrl === 'function' ? manifest.baseUrl() : manifest.baseUrl;
  return raw.replace(/\/+$/, '');
}
