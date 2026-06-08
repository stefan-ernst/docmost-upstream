import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Loader,
  PasswordInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconAlertCircle, IconPlug } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useGetIntegrationConnectionsQuery,
  useSaveIntegrationConnectionMutation,
} from "@/features/integrations/queries/integration-oauth-query";
import { IntegrationOAuthConnection } from "@/features/integrations/types/integration.types";

export default function AdminIntegrationConnections() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useGetIntegrationConnectionsQuery();

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle />}>
        {t("Failed to load integration connections")}
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Alert color="gray" icon={<IconPlug />}>
        {t("No integration providers are available in this deployment.")}
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Alert color="blue" icon={<IconPlug />}>
        {t(
          "Configure the base connection for this Docmost workspace. This does not grant members access through your Windshift account; each user still connects their own account from Account → Integrations.",
        )}
      </Alert>
      {data.map((connection) => (
        <AdminIntegrationConnectionCard
          key={connection.integrationId}
          connection={connection}
        />
      ))}
    </Stack>
  );
}

function AdminIntegrationConnectionCard({
  connection,
}: {
  connection: IntegrationOAuthConnection;
}) {
  const { t } = useTranslation();
  const save = useSaveIntegrationConnectionMutation();
  const [enabled, setEnabled] = useState(connection.enabled);
  const [baseUrl, setBaseUrl] = useState(connection.baseUrl ?? "");
  const [oauthClientId, setOauthClientId] = useState(
    connection.oauthClientId ?? "",
  );
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [defaultWorkspaceKey, setDefaultWorkspaceKey] = useState(
    connection.defaultWorkspaceKey ?? "",
  );

  useEffect(() => {
    setEnabled(connection.enabled);
    setBaseUrl(connection.baseUrl ?? "");
    setOauthClientId(connection.oauthClientId ?? "");
    setOauthClientSecret("");
    setDefaultWorkspaceKey(connection.defaultWorkspaceKey ?? "");
  }, [connection]);

  const onSave = () => {
    save.mutate({
      integrationId: connection.integrationId,
      input: {
        enabled,
        baseUrl,
        oauthClientId,
        oauthClientSecret:
          oauthClientSecret.length > 0 ? oauthClientSecret : undefined,
        defaultWorkspaceKey: defaultWorkspaceKey || null,
      },
    });
  };

  return (
    <Card withBorder padding="lg" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4} style={{ flex: 1 }}>
            <Group gap="sm" align="center">
              <Text fw={600}>{connection.name}</Text>
              {connection.configured ? (
                <Badge
                  color={connection.enabled ? "green" : "gray"}
                  variant="light"
                >
                  {connection.enabled ? t("Enabled") : t("Disabled")}
                </Badge>
              ) : (
                <Badge color="orange" variant="light">
                  {t("Not configured")}
                </Badge>
              )}
              {connection.source === "env" && (
                <Badge variant="default">{t("Env default")}</Badge>
              )}
            </Group>
            {connection.description && (
              <Text size="sm" c="dimmed">
                {connection.description}
              </Text>
            )}
          </Stack>
          <Switch
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
            label={t("Enabled")}
          />
        </Group>

        <TextInput
          label={t("Windshift base URL")}
          placeholder="https://windshift.example.com"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.currentTarget.value)}
          required
        />
        <TextInput
          label={t("OAuth client ID")}
          value={oauthClientId}
          onChange={(event) => setOauthClientId(event.currentTarget.value)}
          required
        />
        <PasswordInput
          label={t("OAuth client secret")}
          description={
            connection.hasClientSecret
              ? t("Leave blank to keep the stored secret.")
              : undefined
          }
          value={oauthClientSecret}
          onChange={(event) => setOauthClientSecret(event.currentTarget.value)}
        />
        <TextInput
          label={t("Default Windshift workspace key")}
          description={t("Optional hint used by the Windshift provider.")}
          placeholder="WI"
          value={defaultWorkspaceKey}
          onChange={(event) =>
            setDefaultWorkspaceKey(event.currentTarget.value)
          }
        />

        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {t("Redirect URI")}
          </Text>
          <Group gap="xs" align="center">
            <Code>{connection.redirectUri}</Code>
            <CopyButton value={connection.redirectUri}>
              {({ copy, copied }) => (
                <Button size="xs" variant="default" onClick={copy}>
                  {copied ? t("Copied") : t("Copy")}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Stack>

        <Group gap={4}>
          {connection.scopes.map((scope) => (
            <Badge key={scope} variant="default" size="xs">
              {scope}
            </Badge>
          ))}
        </Group>

        <Group justify="flex-end">
          <Button
            onClick={onSave}
            loading={save.isPending}
            disabled={!baseUrl.trim() || !oauthClientId.trim()}
          >
            {t("Save configuration")}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
