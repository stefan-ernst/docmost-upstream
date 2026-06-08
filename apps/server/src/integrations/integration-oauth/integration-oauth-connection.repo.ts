import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  InsertableIntegrationOauthConnection,
  IntegrationOauthConnection,
} from '@docmost/db/types/entity.types';

export interface UpsertIntegrationOAuthConnectionInput {
  workspaceId: string;
  integrationId: string;
  enabled: boolean;
  baseUrl: string;
  oauthClientId: string;
  oauthClientSecretEncrypted?: string | null;
  defaultWorkspaceKey?: string | null;
  actorUserId: string;
}

/** Workspace-scoped admin configuration for an integration OAuth provider. */
@Injectable()
export class IntegrationOAuthConnectionRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async find(
    workspaceId: string,
    integrationId: string,
  ): Promise<IntegrationOauthConnection | undefined> {
    return this.db
      .selectFrom('integrationOauthConnections')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('integrationId', '=', integrationId)
      .executeTakeFirst();
  }

  async listByWorkspace(
    workspaceId: string,
  ): Promise<IntegrationOauthConnection[]> {
    return this.db
      .selectFrom('integrationOauthConnections')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .orderBy('integrationId', 'asc')
      .execute();
  }

  async upsert(
    input: UpsertIntegrationOAuthConnectionInput,
  ): Promise<IntegrationOauthConnection> {
    const row: InsertableIntegrationOauthConnection = {
      workspaceId: input.workspaceId,
      integrationId: input.integrationId,
      enabled: input.enabled,
      baseUrl: input.baseUrl,
      oauthClientId: input.oauthClientId,
      oauthClientSecretEncrypted: input.oauthClientSecretEncrypted ?? null,
      defaultWorkspaceKey: input.defaultWorkspaceKey ?? null,
      createdById: input.actorUserId,
      updatedById: input.actorUserId,
    };

    return this.db
      .insertInto('integrationOauthConnections')
      .values(row)
      .onConflict((oc) =>
        oc.columns(['workspaceId', 'integrationId']).doUpdateSet({
          enabled: input.enabled,
          baseUrl: input.baseUrl,
          oauthClientId: input.oauthClientId,
          oauthClientSecretEncrypted: input.oauthClientSecretEncrypted ?? null,
          defaultWorkspaceKey: input.defaultWorkspaceKey ?? null,
          updatedById: input.actorUserId,
          updatedAt: sql`now()`,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
