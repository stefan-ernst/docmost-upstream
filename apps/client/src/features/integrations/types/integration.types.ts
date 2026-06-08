export interface IntegrationResourceManifest {
  id: string;
  title: string;
  description?: string;
  renderKind: "item-card" | "table-report";
  searchTerms: string[];
  picker?: {
    placeholder?: string;
    emptyLabel?: string;
    searchOnEmpty?: boolean;
  };
  menu?: {
    title: string;
    description?: string;
    searchTerms?: string[];
    icon?: "link" | "table";
  };
}

export interface IntegrationOAuthConnection {
  integrationId: string;
  name: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  configured: boolean;
  source?: "workspace" | "env";
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

export interface IntegrationListItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  scopes: string[];
  connected: boolean;
  needsReconnect: boolean;
  connectedAt?: string;
  expiresAt?: string;
  resources?: IntegrationResourceManifest[];
}
