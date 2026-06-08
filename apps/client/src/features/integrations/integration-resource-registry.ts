import { IntegrationListItem, IntegrationResourceManifest } from "@/features/integrations/types/integration.types";

export interface RegisteredIntegrationResource extends IntegrationResourceManifest {
  integrationId: string;
  integrationName: string;
}

let integrations: IntegrationListItem[] = [];

export function setRegisteredIntegrationCatalog(items: IntegrationListItem[]): void {
  integrations = items;
}

export function getRegisteredIntegrationIds(): Set<string> {
  return new Set(integrations.map((i) => i.id));
}

export function getRegisteredIntegrationResources(): RegisteredIntegrationResource[] {
  return integrations.flatMap((integration) =>
    (integration.resources ?? []).map((resource) => ({
      ...resource,
      integrationId: integration.id,
      integrationName: integration.name,
    })),
  );
}

export function findRegisteredIntegrationResource(
  integrationId: string,
  resourceId: string,
): RegisteredIntegrationResource | undefined {
  return getRegisteredIntegrationResources().find(
    (resource) => resource.integrationId === integrationId && resource.id === resourceId,
  );
}
