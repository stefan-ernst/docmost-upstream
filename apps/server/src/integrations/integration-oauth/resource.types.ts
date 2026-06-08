import { IntegrationOAuthClientService } from './integration-oauth-client.service';

export type IntegrationResourceRenderKind = 'item-card' | 'table-report';

export interface IntegrationResourcePickerManifest {
  placeholder?: string;
  emptyLabel?: string;
  searchOnEmpty?: boolean;
}

export interface IntegrationResourceMenuManifest {
  title: string;
  description?: string;
  searchTerms?: string[];
  icon?: 'link' | 'table';
}

export interface IntegrationResourceSearchResult {
  /** Stable provider-owned key persisted in the editor node. */
  key: string;
  title: string;
  subtitle?: string;
  badge?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationItemCardPayload {
  kind: 'item-card';
  key: string;
  title: string;
  url?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationTableReportRow {
  id: string;
  key?: string;
  title: string;
  url?: string;
  status?: string;
  assignee?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationTableReportPayload {
  kind: 'table-report';
  title: string;
  description?: string;
  total?: number;
  rows: IntegrationTableReportRow[];
  pagination?: Record<string, unknown>;
}

export type IntegrationResolvedResource =
  | IntegrationItemCardPayload
  | IntegrationTableReportPayload;

export interface IntegrationResourceContext {
  integrationId: string;
  userId: string;
  client: IntegrationOAuthClientService;
}

export interface IntegrationResourceSearchArgs {
  q?: string;
  limit?: number;
}

export interface IntegrationResourceResolveArgs {
  resourceKey: string;
  params?: Record<string, unknown>;
}

/**
 * Declarative, safe resource surface exposed to the editor. Providers own all
 * outbound paths and normalization here; the generic controller never accepts
 * arbitrary provider paths, methods, or unvetted query forwarding.
 */
export interface IntegrationResourceManifest {
  id: string;
  title: string;
  description?: string;
  renderKind: IntegrationResourceRenderKind;
  searchTerms?: string[];
  picker?: IntegrationResourcePickerManifest;
  menu?: IntegrationResourceMenuManifest;
  /** Human-readable security contract for review/docs. */
  security?: {
    outboundPaths: string[];
    methods: string[];
    forwardedQueryParams?: string[];
    cacheTtlMs?: number;
  };
  search?: (
    ctx: IntegrationResourceContext,
    args: IntegrationResourceSearchArgs,
  ) => Promise<IntegrationResourceSearchResult[]>;
  resolve: (
    ctx: IntegrationResourceContext,
    args: IntegrationResourceResolveArgs,
  ) => Promise<IntegrationResolvedResource>;
}

export interface PublicIntegrationResourceManifest {
  id: string;
  title: string;
  description?: string;
  renderKind: IntegrationResourceRenderKind;
  searchTerms: string[];
  picker?: IntegrationResourcePickerManifest;
  menu?: IntegrationResourceMenuManifest;
}

export function toPublicResourceManifest(
  resource: IntegrationResourceManifest,
): PublicIntegrationResourceManifest {
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    renderKind: resource.renderKind,
    searchTerms: resource.searchTerms ?? [],
    picker: resource.picker,
    menu: resource.menu,
  };
}
