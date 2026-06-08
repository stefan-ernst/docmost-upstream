import {
  ActionIcon,
  Anchor,
  Badge,
  Card,
  Group,
  Loader,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { IconAlertCircle, IconExternalLink, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  useResolveIntegrationResourceQuery,
  useSearchIntegrationResourceQuery,
} from "@/features/integrations/queries/integration-resource-query";
import {
  IntegrationItemCardPayload,
  IntegrationResourceSearchResult,
  IntegrationTableReportPayload,
} from "@/features/integrations/services/integration-resource-service";
import { findRegisteredIntegrationResource } from "@/features/integrations/integration-resource-registry";

const NO_UNDERLINE: React.CSSProperties = {
  textDecoration: "none",
  borderBottom: "none",
  cursor: "pointer",
};

interface IntegrationEmbedAttrs {
  integrationId?: string;
  resourceId?: string;
  resourceKey?: string;
  labelAtInsert?: string;
  renderKind?: string;
  params?: Record<string, unknown> | null;
}

export default function IntegrationEmbedView(props: NodeViewProps) {
  const attrs = props.node.attrs as IntegrationEmbedAttrs;
  const integrationId = attrs.integrationId ?? "";
  const resourceId = attrs.resourceId ?? "";
  const manifest = findRegisteredIntegrationResource(integrationId, resourceId);

  if (!integrationId || !resourceId) {
    return <Unavailable message="Integration resource is not configured" />;
  }

  if (!attrs.resourceKey) {
    return (
      <EmptyState
        integrationId={integrationId}
        resourceId={resourceId}
        title={manifest?.title ?? "Integration embed"}
        placeholder={manifest?.picker?.placeholder}
        emptyLabel={manifest?.picker?.emptyLabel}
        searchOnEmpty={manifest?.picker?.searchOnEmpty}
        renderKind={manifest?.renderKind ?? attrs.renderKind}
        updateAttributes={props.updateAttributes}
      />
    );
  }

  return (
    <ResolvedState
      integrationId={integrationId}
      resourceId={resourceId}
      resourceKey={attrs.resourceKey}
      labelAtInsert={attrs.labelAtInsert}
      params={attrs.params}
      updateAttributes={props.updateAttributes}
    />
  );
}

function EmptyState(props: {
  integrationId: string;
  resourceId: string;
  title: string;
  placeholder?: string;
  emptyLabel?: string;
  searchOnEmpty?: boolean;
  renderKind?: string;
  updateAttributes: NodeViewProps["updateAttributes"];
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(value.trim(), 200);
  const search = useSearchIntegrationResourceQuery({
    integrationId: props.integrationId,
    resourceId: props.resourceId,
    q: debouncedQuery,
    searchOnEmpty: props.searchOnEmpty,
  });

  const pick = (result: IntegrationResourceSearchResult) => {
    props.updateAttributes({
      resourceKey: result.key,
      labelAtInsert: result.title,
      renderKind: props.renderKind,
      params: null,
    });
  };

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const first = search.data?.[0];
    if (first) pick(first);
  };

  return (
    <NodeViewWrapper>
      <Card withBorder padding="md" radius="md">
        <form onSubmit={onSubmit}>
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {t("Embed {{title}}", { title: props.title })}
            </Text>
            <TextInput
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              placeholder={props.placeholder ?? t("Search…")}
              autoFocus
              rightSection={search.isFetching ? <Loader size="xs" /> : null}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit(e);
              }}
            />
            <SearchResultList
              results={search.data ?? []}
              isLoading={search.isFetching && !search.data}
              query={debouncedQuery}
              searchOnEmpty={props.searchOnEmpty}
              emptyLabel={props.emptyLabel}
              onPick={pick}
            />
          </Stack>
        </form>
      </Card>
    </NodeViewWrapper>
  );
}

function SearchResultList(props: {
  results: IntegrationResourceSearchResult[];
  isLoading: boolean;
  query: string;
  searchOnEmpty?: boolean;
  emptyLabel?: string;
  onPick: (result: IntegrationResourceSearchResult) => void;
}) {
  const { t } = useTranslation();
  if (!props.searchOnEmpty && props.query.length === 0) return null;
  if (props.isLoading) {
    return (
      <Text size="xs" c="dimmed">
        {t("Searching…")}
      </Text>
    );
  }
  if (props.results.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        {props.emptyLabel ? t(props.emptyLabel) : t("No matching resources")}
      </Text>
    );
  }
  return (
    <Stack gap={4}>
      {props.results.map((result) => (
        <UnstyledButton
          key={result.key}
          onClick={() => props.onPick(result)}
          style={{ padding: "6px 8px", borderRadius: 4, display: "block", width: "100%" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--mantine-color-gray-1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <Group gap="xs" wrap="nowrap">
            {result.badge && (
              <Badge color="blue" variant="filled" size="sm">
                {result.badge}
              </Badge>
            )}
            <Text size="sm" lineClamp={1} style={{ flex: 1 }}>
              {result.title}
            </Text>
            {result.subtitle && (
              <Badge variant="default" size="xs">
                {result.subtitle}
              </Badge>
            )}
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  );
}

function ResolvedState(props: {
  integrationId: string;
  resourceId: string;
  resourceKey: string;
  labelAtInsert?: string;
  params?: Record<string, unknown> | null;
  updateAttributes: NodeViewProps["updateAttributes"];
}) {
  const { t } = useTranslation();
  const query = useResolveIntegrationResourceQuery({
    integrationId: props.integrationId,
    resourceId: props.resourceId,
    resourceKey: props.resourceKey,
    params: props.params,
  });

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") query.refetch();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (query.data?.kind === "item-card" && query.data.key && query.data.key !== props.resourceKey) {
      props.updateAttributes({ resourceKey: query.data.key, labelAtInsert: query.data.title, params: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  if (query.isLoading) {
    return (
      <NodeViewWrapper>
        <Card withBorder padding="md" radius="md">
          <Skeleton height={20} width="60%" mb="xs" />
          <Skeleton height={14} width="40%" />
        </Card>
      </NodeViewWrapper>
    );
  }

  if (query.isError) {
    return <ErrorState error={query.error} fallbackLabel={props.labelAtInsert || props.resourceKey} refetch={() => query.refetch()} />;
  }

  if (query.data?.kind === "item-card") {
    return <ItemCard payload={query.data} refetch={() => query.refetch()} isFetching={query.isFetching} />;
  }
  if (query.data?.kind === "table-report") {
    return <TableReport payload={query.data} refetch={() => query.refetch()} isFetching={query.isFetching} />;
  }
  return <Unavailable message={t("Unsupported integration resource")} />;
}

function ErrorState(props: { error: Error; fallbackLabel: string; refetch: () => void }) {
  const { t } = useTranslation();
  const status = (props.error as Error & { response?: { status?: number; data?: { code?: string } } })?.response?.status;
  const code = (props.error as Error & { response?: { data?: { code?: string } } })?.response?.data?.code;

  if (status === 409 && (code === "INTEGRATION_NOT_CONNECTED" || code === "INTEGRATION_RECONNECT_REQUIRED")) {
    return (
      <NodeViewWrapper>
        <Card withBorder padding="md" radius="md">
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {code === "INTEGRATION_NOT_CONNECTED"
                ? t("Integration not connected")
                : t("Reconnect integration to refresh")}
            </Text>
            <Anchor component={Link} to="/settings/account/integrations" size="sm">
              {t("Connect integration")}
            </Anchor>
          </Group>
        </Card>
      </NodeViewWrapper>
    );
  }

  if (status && status >= 400 && status < 500) {
    return (
      <NodeViewWrapper>
        <Card withBorder padding="md" radius="md">
          <Group gap="xs">
            <Badge color="gray" variant="light">
              {props.fallbackLabel}
            </Badge>
            <Text size="sm" c="dimmed">
              {t("Resource unavailable")}
            </Text>
          </Group>
        </Card>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <Card withBorder padding="md" radius="md">
        <Group gap="xs">
          <IconAlertCircle size={16} />
          <Text size="sm">{t("Failed to load")}</Text>
          <ActionIcon variant="subtle" onClick={props.refetch} aria-label={t("Refresh")}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>
      </Card>
    </NodeViewWrapper>
  );
}

function ItemCard(props: { payload: IntegrationItemCardPayload; refetch: () => void; isFetching: boolean }) {
  const { t } = useTranslation();
  const keyBadge = (
    <Badge color="blue" variant="filled" size="sm">
      {props.payload.key}
    </Badge>
  );
  return (
    <NodeViewWrapper>
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs">
              {props.payload.url ? (
                <a href={props.payload.url} target="_blank" rel="noreferrer" style={NO_UNDERLINE}>
                  {keyBadge}
                </a>
              ) : (
                keyBadge
              )}
              {props.payload.status && <Badge variant="light">{props.payload.status}</Badge>}
              {props.payload.priority && (
                <Badge variant="default" size="xs">
                  {props.payload.priority}
                </Badge>
              )}
            </Group>
            {props.payload.url ? (
              <a href={props.payload.url} target="_blank" rel="noreferrer" style={{ ...NO_UNDERLINE, color: "inherit" }}>
                <Text fw={600} lineClamp={2}>{props.payload.title}</Text>
              </a>
            ) : (
              <Text fw={600} lineClamp={2}>{props.payload.title}</Text>
            )}
            {props.payload.assignee && (
              <Text size="xs" c="dimmed">
                {t("Assigned to")} {props.payload.assignee}
              </Text>
            )}
          </Stack>
          <Group gap={4}>
            {props.payload.url && (
              <ActionIcon component="a" href={props.payload.url} target="_blank" rel="noreferrer" variant="subtle" aria-label={t("Open")}> 
                <IconExternalLink size={16} />
              </ActionIcon>
            )}
            <ActionIcon variant="subtle" onClick={props.refetch} aria-label={t("Refresh")} loading={props.isFetching}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Card>
    </NodeViewWrapper>
  );
}

function TableReport(props: { payload: IntegrationTableReportPayload; refetch: () => void; isFetching: boolean }) {
  const { t } = useTranslation();
  return (
    <NodeViewWrapper>
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" mb="sm">
          <Stack gap={2}>
            <Text fw={600}>{props.payload.title}</Text>
            {props.payload.description && (
              <Text size="xs" c="dimmed">{props.payload.description}</Text>
            )}
          </Stack>
          <Group gap={4}>
            {props.payload.total != null && <Badge variant="default">{t("{{ n }} items", { n: props.payload.total })}</Badge>}
            <ActionIcon variant="subtle" onClick={props.refetch} loading={props.isFetching} aria-label={t("Refresh")}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>
        {props.payload.rows.length === 0 ? (
          <Text size="sm" c="dimmed">{t("No rows to display.")}</Text>
        ) : (
          <Table withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("Key")}</Table.Th>
                <Table.Th>{t("Title")}</Table.Th>
                <Table.Th>{t("Status")}</Table.Th>
                <Table.Th>{t("Assignee")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {props.payload.rows.map((row) => {
                const keyBadge = row.key ? (
                  <Badge color="blue" variant="filled" size="sm">{row.key}</Badge>
                ) : (
                  "—"
                );
                return (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      {row.url && row.key ? (
                        <Tooltip label={t("Open")} withArrow openDelay={300}>
                          <a href={row.url} target="_blank" rel="noreferrer" style={NO_UNDERLINE}>{keyBadge}</a>
                        </Tooltip>
                      ) : (
                        keyBadge
                      )}
                    </Table.Td>
                    <Table.Td>
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noreferrer" style={{ ...NO_UNDERLINE, color: "inherit" }}>{row.title}</a>
                      ) : (
                        row.title
                      )}
                    </Table.Td>
                    <Table.Td>{row.status ?? "—"}</Table.Td>
                    <Table.Td>{row.assignee ?? "—"}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </NodeViewWrapper>
  );
}

function Unavailable(props: { message: string }) {
  return (
    <NodeViewWrapper>
      <Card withBorder padding="md" radius="md">
        <Text size="sm" c="dimmed">{props.message}</Text>
      </Card>
    </NodeViewWrapper>
  );
}
