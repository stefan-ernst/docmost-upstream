import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  decryptString,
  encryptString,
} from '../../common/helpers/encryption.helper';
import { EnvironmentService } from '../environment/environment.service';
import { IntegrationManifest, resolveBaseUrl } from './manifest.types';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationOAuthConnectionRepo } from './integration-oauth-connection.repo';

const CLIENT_SECRET_ENCRYPTION_INFO = 'integration-oauth-client-secret-v1';

export interface ResolvedIntegrationOAuthConnection {
  integrationId: string;
  workspaceId: string;
  enabled: boolean;
  source: 'workspace' | 'env';
  baseUrl: string;
  oauthClientId: string;
  oauthClientSecret?: string;
  defaultWorkspaceKey?: string;
}

export interface PublicIntegrationOAuthConnection {
  integrationId: string;
  name: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  configured: boolean;
  source?: 'workspace' | 'env';
  baseUrl?: string;
  oauthClientId?: string;
  hasClientSecret: boolean;
  defaultWorkspaceKey?: string;
  redirectUri: string;
  scopes: string[];
}

export interface SaveIntegrationOAuthConnectionInput {
  enabled?: boolean;
  baseUrl: string;
  oauthClientId: string;
  oauthClientSecret?: string | null;
  defaultWorkspaceKey?: string | null;
}

@Injectable()
export class IntegrationOAuthConnectionService {
  constructor(
    private readonly registry: IntegrationOAuthRegistry,
    private readonly repo: IntegrationOAuthConnectionRepo,
    private readonly environmentService: EnvironmentService,
    private readonly configService: ConfigService,
  ) {}

  async listAdmin(
    workspaceId: string,
  ): Promise<PublicIntegrationOAuthConnection[]> {
    const rows = await this.repo.listByWorkspace(workspaceId);
    const rowsByIntegration = new Map(rows.map((r) => [r.integrationId, r]));

    return this.registry.list().map((manifest) => {
      const row = rowsByIntegration.get(manifest.id);
      const env = row ? null : this.resolveEnv(manifest, workspaceId);
      return {
        integrationId: manifest.id,
        name: manifest.name,
        description: manifest.description,
        icon: manifest.icon,
        enabled: row ? row.enabled : (env?.enabled ?? false),
        configured: !!row || !!env,
        source: row ? 'workspace' : env?.source,
        baseUrl: row?.baseUrl ?? env?.baseUrl,
        oauthClientId: row?.oauthClientId ?? env?.oauthClientId,
        hasClientSecret:
          !!row?.oauthClientSecretEncrypted || !!env?.oauthClientSecret,
        defaultWorkspaceKey:
          row?.defaultWorkspaceKey ?? env?.defaultWorkspaceKey,
        redirectUri: this.callbackUrl(manifest.id),
        scopes: manifest.scopes,
      };
    });
  }

  async listConfigured(
    workspaceId: string,
  ): Promise<Map<string, ResolvedIntegrationOAuthConnection>> {
    const out = new Map<string, ResolvedIntegrationOAuthConnection>();
    for (const manifest of this.registry.list()) {
      const resolved = await this.resolve(workspaceId, manifest.id);
      if (resolved?.enabled) out.set(manifest.id, resolved);
    }
    return out;
  }

  async resolve(
    workspaceId: string,
    integrationId: string,
  ): Promise<ResolvedIntegrationOAuthConnection | null> {
    const manifest = this.registry.require(integrationId);
    const row = await this.repo.find(workspaceId, integrationId);
    if (row) {
      return {
        integrationId,
        workspaceId,
        enabled: row.enabled,
        source: 'workspace',
        baseUrl: row.baseUrl,
        oauthClientId: row.oauthClientId,
        oauthClientSecret: row.oauthClientSecretEncrypted
          ? decryptString(
              row.oauthClientSecretEncrypted,
              this.environmentService.getAppSecret(),
              CLIENT_SECRET_ENCRYPTION_INFO,
            )
          : undefined,
        defaultWorkspaceKey: row.defaultWorkspaceKey ?? undefined,
      };
    }
    return this.resolveEnv(manifest, workspaceId);
  }

  async requireEnabled(
    workspaceId: string,
    integrationId: string,
  ): Promise<ResolvedIntegrationOAuthConnection> {
    const resolved = await this.resolve(workspaceId, integrationId);
    if (!resolved?.enabled) {
      throw new BadRequestException(
        `Integration is not configured: ${integrationId}`,
      );
    }
    return resolved;
  }

  async save(
    workspaceId: string,
    integrationId: string,
    actorUserId: string,
    input: SaveIntegrationOAuthConnectionInput,
  ): Promise<PublicIntegrationOAuthConnection> {
    const manifest = this.registry.require(integrationId);
    const current = await this.repo.find(workspaceId, integrationId);
    const baseUrl = this.normalizeBaseUrl(input.baseUrl);
    const oauthClientId = input.oauthClientId.trim();
    if (!oauthClientId) {
      throw new BadRequestException('OAuth client ID is required');
    }

    const envSecret = this.resolveEnv(manifest, workspaceId)?.oauthClientSecret;
    let oauthClientSecretEncrypted =
      current?.oauthClientSecretEncrypted ?? null;
    if (
      !current &&
      typeof input.oauthClientSecret === 'undefined' &&
      envSecret
    ) {
      oauthClientSecretEncrypted = encryptString(
        envSecret,
        this.environmentService.getAppSecret(),
        CLIENT_SECRET_ENCRYPTION_INFO,
      );
    }
    if (typeof input.oauthClientSecret !== 'undefined') {
      const raw = input.oauthClientSecret?.trim() ?? '';
      oauthClientSecretEncrypted = raw
        ? encryptString(
            raw,
            this.environmentService.getAppSecret(),
            CLIENT_SECRET_ENCRYPTION_INFO,
          )
        : null;
    }

    const defaultWorkspaceKey = input.defaultWorkspaceKey?.trim() || null;
    if (
      defaultWorkspaceKey &&
      !/^[A-Za-z][A-Za-z0-9]*$/.test(defaultWorkspaceKey)
    ) {
      throw new BadRequestException(
        'Default Windshift workspace key is invalid',
      );
    }

    const row = await this.repo.upsert({
      workspaceId,
      integrationId,
      enabled: input.enabled ?? true,
      baseUrl,
      oauthClientId,
      oauthClientSecretEncrypted,
      defaultWorkspaceKey: defaultWorkspaceKey?.toUpperCase() ?? null,
      actorUserId,
    });

    return {
      integrationId: manifest.id,
      name: manifest.name,
      description: manifest.description,
      icon: manifest.icon,
      enabled: row.enabled,
      configured: true,
      source: 'workspace',
      baseUrl: row.baseUrl,
      oauthClientId: row.oauthClientId,
      hasClientSecret: !!row.oauthClientSecretEncrypted,
      defaultWorkspaceKey: row.defaultWorkspaceKey ?? undefined,
      redirectUri: this.callbackUrl(manifest.id),
      scopes: manifest.scopes,
    };
  }

  callbackUrl(integrationId: string): string {
    return `${this.environmentService.getAppUrl()}/api/integrations/oauth/${integrationId}/callback`;
  }

  private resolveEnv(
    manifest: IntegrationManifest,
    workspaceId: string,
  ): ResolvedIntegrationOAuthConnection | null {
    const baseUrl = this.normalizeOptionalBaseUrl(resolveBaseUrl(manifest));
    const oauthClientId =
      this.configService.get<string>(manifest.clientIdEnv) || '';
    if (!baseUrl || !oauthClientId) return null;
    return {
      integrationId: manifest.id,
      workspaceId,
      enabled: true,
      source: 'env',
      baseUrl,
      oauthClientId,
      oauthClientSecret: manifest.clientSecretEnv
        ? this.configService.get<string>(manifest.clientSecretEnv) || undefined
        : undefined,
    };
  }

  private normalizeOptionalBaseUrl(raw: string): string | null {
    if (!raw) return null;
    try {
      return this.normalizeBaseUrl(raw);
    } catch {
      return null;
    }
  }

  private normalizeBaseUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) throw new BadRequestException('Base URL is required');
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException('Base URL must be a valid URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException('Base URL must use http or https');
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  }
}
