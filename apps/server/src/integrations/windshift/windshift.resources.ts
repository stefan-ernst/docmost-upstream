import {
  IntegrationItemCardPayload,
  IntegrationResourceManifest,
  IntegrationResourceSearchResult,
  IntegrationTableReportPayload,
} from '../integration-oauth/resource.types';

interface WindshiftItem {
  id: number;
  workspace_id: number;
  workspace_key: string;
  workspace_item_number: number;
  key?: string;
  title: string;
  status?: { name?: string };
  priority?: { name?: string };
  assignee?: { full_name?: string; email?: string };
}

interface WindshiftCollection {
  id: number;
  slug?: string;
  name: string;
  description?: string;
}

function windshiftUrl(baseUrl: string, path: string): string | undefined {
  const base = baseUrl.replace(/\/+$/, '');
  if (!base) return undefined;
  return `${base}${path}`;
}

function itemKey(item: WindshiftItem): string {
  return item.key || `${item.workspace_key}-${item.workspace_item_number}`;
}

function itemUrl(baseUrl: string, item: WindshiftItem): string | undefined {
  return windshiftUrl(
    baseUrl,
    `/workspaces/${item.workspace_id}/items/${item.id}`,
  );
}

function normalizeItemCard(
  baseUrl: string,
  item: WindshiftItem,
): IntegrationItemCardPayload {
  return {
    kind: 'item-card',
    key: itemKey(item),
    title: item.title,
    url: itemUrl(baseUrl, item),
    status: item.status?.name,
    priority: item.priority?.name,
    assignee: item.assignee?.full_name ?? item.assignee?.email,
    metadata: {
      id: item.id,
      workspaceId: item.workspace_id,
      workspaceKey: item.workspace_key,
      itemNumber: item.workspace_item_number,
    },
  };
}

function normalizeItemSearch(
  item: WindshiftItem,
): IntegrationResourceSearchResult {
  return {
    key: itemKey(item),
    title: item.title,
    subtitle: item.status?.name,
    badge: itemKey(item),
    metadata: {
      workspaceKey: item.workspace_key,
      itemNumber: item.workspace_item_number,
    },
  };
}

function parseItemKey(
  raw: string,
): { workspaceKey: string; itemNumber: number } | null {
  const match = raw.trim().match(/^([A-Za-z][A-Za-z0-9]*)[-_\s]?(\d+)$/);
  if (!match) return null;
  return {
    workspaceKey: match[1].toUpperCase(),
    itemNumber: Number.parseInt(match[2], 10),
  };
}

function collectionKey(collection: WindshiftCollection): string {
  return collection.slug && collection.slug.length > 0
    ? collection.slug
    : String(collection.id);
}

export const WINDSHIFT_RESOURCES: IntegrationResourceManifest[] = [
  {
    id: 'item',
    title: 'Windshift item',
    description: 'Embed a live Windshift item card.',
    renderKind: 'item-card',
    searchTerms: ['windshift', 'item', 'ticket', 'task'],
    picker: {
      placeholder: 'Search by title or paste WI-123',
      emptyLabel: 'No matching items',
    },
    menu: {
      title: 'Windshift item',
      description: 'Embed a live Windshift item card',
      searchTerms: ['windshift', 'item', 'ticket', 'task'],
      icon: 'link',
    },
    security: {
      outboundPaths: [
        '/rest/api/v1/search/items',
        '/rest/api/v1/workspaces/:workspaceKey/items/:itemNumber',
        '/rest/api/v1/items/:id',
      ],
      methods: ['GET'],
      forwardedQueryParams: ['q', 'limit'],
      cacheTtlMs: 30_000,
    },
    async search(ctx, args) {
      const q = args.q?.trim() ?? '';
      if (!q) return [];

      const parsed = parseItemKey(q);
      if (parsed) {
        const key = `${parsed.workspaceKey}-${parsed.itemNumber}`;
        return [{ key, title: key, badge: key }];
      }

      const body = await ctx.client.get<{ data?: WindshiftItem[] }>(
        ctx.integrationId,
        ctx.workspaceId,
        ctx.userId,
        '/rest/api/v1/search/items',
        { q, limit: args.limit ?? 10 },
      );
      return (body.data ?? []).map(normalizeItemSearch);
    },
    async resolve(ctx, args) {
      let item: WindshiftItem;
      const idHint = args.resourceKey.startsWith('id:')
        ? Number.parseInt(args.resourceKey.slice(3), 10)
        : undefined;
      if (idHint && Number.isFinite(idHint)) {
        item = await ctx.client.get<WindshiftItem>(
          ctx.integrationId,
          ctx.workspaceId,
          ctx.userId,
          `/rest/api/v1/items/${encodeURIComponent(String(idHint))}`,
        );
      } else {
        const parsed = parseItemKey(args.resourceKey);
        if (!parsed) {
          const err = new Error('Invalid Windshift item key');
          (err as Error & { status?: number }).status = 400;
          throw err;
        }
        item = await ctx.client.get<WindshiftItem>(
          ctx.integrationId,
          ctx.workspaceId,
          ctx.userId,
          `/rest/api/v1/workspaces/${encodeURIComponent(parsed.workspaceKey)}/items/${encodeURIComponent(String(parsed.itemNumber))}`,
        );
      }
      const baseUrl = await ctx.client.baseUrl(
        ctx.integrationId,
        ctx.workspaceId,
      );
      return normalizeItemCard(baseUrl, item);
    },
  },
  {
    id: 'collectionReport',
    title: 'Windshift report',
    description: 'Embed a live Windshift collection report.',
    renderKind: 'table-report',
    searchTerms: ['windshift', 'report', 'collection', 'table'],
    picker: {
      placeholder: 'Search collections by name…',
      emptyLabel: 'No matching collections',
      searchOnEmpty: true,
    },
    menu: {
      title: 'Windshift report',
      description: 'Embed a live Windshift collection report',
      searchTerms: ['windshift', 'report', 'collection', 'table'],
      icon: 'table',
    },
    security: {
      outboundPaths: [
        '/rest/api/v1/collections',
        '/rest/api/v1/collections/:key',
        '/rest/api/v1/collections/:key/items',
      ],
      methods: ['GET'],
      forwardedQueryParams: ['q', 'limit', 'cursor'],
      cacheTtlMs: 30_000,
    },
    async search(ctx, args) {
      const query: Record<string, string | number | undefined> = {
        limit: args.limit ?? 10,
      };
      if (args.q) query.q = args.q;
      const body = await ctx.client.get<{
        items?: WindshiftCollection[];
        data?: WindshiftCollection[];
      }>(
        ctx.integrationId,
        ctx.workspaceId,
        ctx.userId,
        '/rest/api/v1/collections',
        query,
      );
      return (body.items ?? body.data ?? []).map((collection) => ({
        key: collectionKey(collection),
        title: collection.name,
        subtitle: collection.description,
        badge: collection.slug,
      }));
    },
    async resolve(ctx, args) {
      const key = args.resourceKey;
      const collection = await ctx.client.get<WindshiftCollection>(
        ctx.integrationId,
        ctx.workspaceId,
        ctx.userId,
        `/rest/api/v1/collections/${encodeURIComponent(key)}`,
      );
      const body = await ctx.client.get<{
        data?: WindshiftItem[];
        pagination?: { total?: number; [key: string]: unknown };
      }>(
        ctx.integrationId,
        ctx.workspaceId,
        ctx.userId,
        `/rest/api/v1/collections/${encodeURIComponent(key)}/items`,
        { limit: 50 },
      );
      const rows = body.data ?? [];
      const baseUrl = await ctx.client.baseUrl(
        ctx.integrationId,
        ctx.workspaceId,
      );
      const payload: IntegrationTableReportPayload = {
        kind: 'table-report',
        title: collection.name,
        description: collection.description,
        total: body.pagination?.total ?? rows.length,
        pagination: body.pagination,
        rows: rows.map((item) => ({
          id: String(item.id),
          key: itemKey(item),
          title: item.title,
          url: itemUrl(baseUrl, item),
          status: item.status?.name,
          assignee: item.assignee?.full_name ?? item.assignee?.email,
        })),
      };
      return payload;
    },
  },
];
