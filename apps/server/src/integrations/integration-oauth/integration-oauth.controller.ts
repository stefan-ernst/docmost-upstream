import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../environment/environment.service';
import { IntegrationOAuthRegistry } from './manifest.registry';
import { IntegrationOAuthService } from './integration-oauth.service';
import { IntegrationOAuthTokenRepo } from './integration-oauth-token.repo';
import {
  PublicIntegrationResourceManifest,
  toPublicResourceManifest,
} from './resource.types';

/**
 * Explicit 302 + Location + send. NestJS+Fastify's `reply.redirect(url)`
 * alone gets ignored in some configurations (the response goes out as a 200
 * with empty body instead) — being explicit avoids the framework guessing.
 */
function sendRedirect(reply: FastifyReply, url: string): void {
  reply.code(302).header('location', url).send();
}

interface IntegrationListItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  scopes: string[];
  connected: boolean;
  needsReconnect: boolean;
  connectedAt?: string;
  expiresAt?: string;
  resources: PublicIntegrationResourceManifest[];
}

// Mounts under the app's global `/api` prefix → `/api/integrations/oauth/*`.
@Controller('integrations/oauth')
@UseGuards(JwtAuthGuard)
export class IntegrationOAuthController {
  private readonly logger = new Logger(IntegrationOAuthController.name);

  constructor(
    private readonly registry: IntegrationOAuthRegistry,
    private readonly oauthService: IntegrationOAuthService,
    private readonly tokenRepo: IntegrationOAuthTokenRepo,
    private readonly environmentService: EnvironmentService,
  ) {}

  /** Manifests + per-user connection state for the settings UI. */
  @Get()
  async list(@AuthUser() user: User): Promise<IntegrationListItem[]> {
    const tokens = await this.tokenRepo.listByUser(user.id);
    const tokensByIntegration = new Map(tokens.map((t) => [t.integrationId, t]));
    return this.registry.list().map((m) => {
      const t = tokensByIntegration.get(m.id);
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        icon: m.icon,
        scopes: m.scopes,
        connected: !!t,
        needsReconnect: t?.needsReconnect ?? false,
        connectedAt: t?.createdAt instanceof Date ? t.createdAt.toISOString() : undefined,
        expiresAt: t?.expiresAt instanceof Date ? t.expiresAt.toISOString() : undefined,
        resources: (m.resources ?? []).map(toPublicResourceManifest),
      };
    });
  }

  /** Starts the OAuth flow. */
  @Get(':integrationId/authorize')
  async authorize(
    @AuthUser() user: User,
    @Param('integrationId') integrationId: string,
    @Query('returnTo') returnTo: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!this.registry.get(integrationId)) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    // Relative paths only — guards against open-redirect via returnTo.
    const safeReturnTo =
      returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
        ? returnTo
        : undefined;
    const { url } = await this.oauthService.startAuthorize({
      integrationId,
      userId: user.id,
      returnTo: safeReturnTo,
    });
    sendRedirect(reply, url);
  }

  /** Provider redirects here after the user approves or denies. */
  @Get(':integrationId/callback')
  async callback(
    @Param('integrationId') integrationId: string,
    @Query('code') code: string,
    @Query('state') stateToken: string,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!this.registry.get(integrationId)) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    const settingsUrl = `${this.environmentService.getAppUrl()}/settings/account/integrations`;
    if (error) {
      const reason = encodeURIComponent(errorDescription ?? error);
      sendRedirect(reply, `${settingsUrl}?error=${reason}&integration=${integrationId}`);
      return;
    }
    if (!code || !stateToken) {
      throw new BadRequestException('Missing code or state');
    }
    try {
      const { returnTo } = await this.oauthService.completeCallback({
        integrationId,
        code,
        stateToken,
      });
      const dest = returnTo
        ? `${this.environmentService.getAppUrl()}${returnTo}`
        : `${settingsUrl}?connected=true&integration=${integrationId}`;
      sendRedirect(reply, dest);
    } catch (err) {
      this.logger.warn(
        `OAuth callback failed for integration=${integrationId}: ${(err as Error).message}`,
      );
      sendRedirect(
        reply,
        `${settingsUrl}?error=callback_failed&integration=${integrationId}`,
      );
    }
  }

  /** Revoke the user's connection — deletes the token row. */
  @Delete(':integrationId/connection')
  async disconnect(
    @AuthUser() user: User,
    @Param('integrationId') integrationId: string,
  ): Promise<{ disconnected: boolean }> {
    if (!this.registry.get(integrationId)) {
      throw new NotFoundException(`Unknown integration: ${integrationId}`);
    }
    await this.oauthService.disconnect(user.id, integrationId);
    return { disconnected: true };
  }
}
