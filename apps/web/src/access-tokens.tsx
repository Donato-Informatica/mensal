import {
  ActionIcon,
  Alert,
  Button,
  CopyButton,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  MAX_ACCESS_TOKEN_NAME_LENGTH,
  type AccessToken,
  type CreatedAccessToken,
  type NewAccessToken,
} from "@mensal/shared";
import { IconCheck, IconCopy, IconTrash } from "@tabler/icons-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import classes from "./access-tokens.module.css";
import type { ApiClient } from "./api-client.ts";
import { ApiError, errorMessage } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { formatDate } from "./format.ts";

const accessTokensKey = ["access-tokens"];

function accessTokensQuery(api: ApiClient) {
  return {
    queryKey: accessTokensKey,
    queryFn: () => api.accessTokens(),
  };
}

function invalidateAccessTokens(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: accessTokensKey });
}

/** Where agents reach the MCP server: this app's own origin (PRD §8.9). */
function mcpUrl() {
  return `${window.location.origin}/api/mcp`;
}

/** The Claude Code command that adds the server with `token`. */
function claudeSnippet(token: string) {
  return `claude mcp add --transport http mensal ${mcpUrl()} --header "Authorization: Bearer ${token}"`;
}

/** The block of Codex's `~/.codex/config.toml` that adds the server. */
function codexSnippet(token: string) {
  return `[mcp_servers.mensal]
url = "${mcpUrl()}"
http_headers = { Authorization = "Bearer ${token}" }`;
}

/**
 * The "Tokens de acesso" modal, opened from the account menu (PRD §7.12). Its
 * content unmounts on close, so a token just created is dropped from memory.
 */
export function AccessTokensModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Tokens de acesso">
      <AccessTokens onClose={onClose} />
    </Modal>
  );
}

type View =
  | { name: "list" }
  | { name: "create" }
  | { name: "created"; token: CreatedAccessToken }
  | { name: "revoke"; token: AccessToken };

function AccessTokens({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>({ name: "list" });
  const toList = () => setView({ name: "list" });

  switch (view.name) {
    case "list":
      return (
        <TokenList
          onClose={onClose}
          onCreate={() => setView({ name: "create" })}
          onRevoke={(token) => setView({ name: "revoke", token })}
        />
      );
    case "create":
      return (
        <CreateToken
          onCancel={toList}
          onCreated={(token) => setView({ name: "created", token })}
        />
      );
    case "created":
      return <CreatedToken token={view.token} onDone={onClose} />;
    case "revoke":
      return (
        <ConfirmRevocation
          token={view.token}
          onCancel={toList}
          onRevoked={toList}
        />
      );
  }
}

function TokenList({
  onClose,
  onCreate,
  onRevoke,
}: {
  onClose: () => void;
  onCreate: () => void;
  onRevoke: (token: AccessToken) => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const tokens = useQuery(accessTokensQuery(api));

  if (tokens.isError) {
    return (
      <Stack gap="md">
        <Alert color="red" variant="light">
          {errorMessage(tokens.error)}
        </Alert>
        <Button variant="default" onClick={() => void tokens.refetch()}>
          Tentar novamente
        </Button>
      </Stack>
    );
  }
  if (!tokens.data) return <Text c="dimmed">Carregando…</Text>;

  return (
    <Stack gap="md">
      {tokens.data.length === 0 ? (
        <Text>
          Um token de acesso deixa um agente seu, como o Claude Code ou o Codex,
          ler e alterar os seus dados. Você pode revogá-lo quando quiser.
        </Text>
      ) : (
        <ul className={classes.list}>
          {tokens.data.map((token) => (
            <li key={token.id} className={classes.row}>
              <div className={classes.details}>
                <Text fw={600} c="bright" truncate>
                  {token.name}
                </Text>
                <Text c="dimmed" fz="sm">
                  {token.prefix}… · Criado em {formatDate(token.createdAt)} ·{" "}
                  {token.lastUsedAt === null
                    ? "Nunca usado"
                    : `Usado em ${formatDate(token.lastUsedAt)}`}
                </Text>
              </div>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Revogar ${token.name}`}
                onClick={() => onRevoke(token)}
              >
                <IconTrash size={18} aria-hidden="true" />
              </ActionIcon>
            </li>
          ))}
        </ul>
      )}
      <DialogActions>
        <Button variant="default" onClick={onClose}>
          Fechar
        </Button>
        <Button onClick={onCreate}>Criar token</Button>
      </DialogActions>
    </Stack>
  );
}

function CreateToken({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (token: CreatedAccessToken) => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: (input: NewAccessToken): Promise<CreatedAccessToken> =>
      api.createAccessToken(input),
    onSuccess: async (token: CreatedAccessToken) => {
      await invalidateAccessTokens(queryClient);
      onCreated(token);
    },
  });
  // A wrong password is that field's error; anything else, the form's.
  const wrongPassword =
    create.error instanceof ApiError &&
    create.error.code === "INVALID_PASSWORD";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        create.mutate({
          name: String(form.get("name")),
          currentPassword: String(form.get("currentPassword")),
        });
      }}
    >
      <Stack gap="md">
        {create.error && !wrongPassword && (
          <Alert color="red" variant="light">
            {errorMessage(create.error)}
          </Alert>
        )}
        <TextInput
          label="Nome"
          description="Para reconhecer o token depois, por exemplo o agente que o usa."
          name="name"
          maxLength={MAX_ACCESS_TOKEN_NAME_LENGTH}
          required
          data-autofocus
        />
        <PasswordInput
          label="Senha atual"
          name="currentPassword"
          autoComplete="current-password"
          required
          error={wrongPassword && errorMessage(create.error)}
          aria-invalid={wrongPassword}
          onChange={() => {
            if (wrongPassword) create.reset();
          }}
        />
        <DialogActions>
          <Button variant="default" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Criar
          </Button>
        </DialogActions>
      </Stack>
    </form>
  );
}

/** A copy button that confirms with a check for a moment. */
function CopyAction({ value, label }: { value: string; label: string }) {
  return (
    <CopyButton value={value}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? "Copiado" : label}>
          <ActionIcon
            variant="subtle"
            color={copied ? "green" : "gray"}
            aria-label={label}
            onClick={copy}
          >
            {copied ? (
              <IconCheck size={18} aria-hidden="true" />
            ) : (
              <IconCopy size={18} aria-hidden="true" />
            )}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}

function Snippet({
  title,
  text,
  testId,
}: {
  title: string;
  text: string;
  testId?: string;
}) {
  return (
    <div>
      <div className={classes.snippetHeader}>
        <Text fw={500} fz="sm">
          {title}
        </Text>
        <CopyAction value={text} label={`Copiar ${title}`} />
      </div>
      <pre className={classes.snippet} data-testid={testId}>
        {text}
      </pre>
    </div>
  );
}

/** The new token, shown once, with the snippets that put it to use. */
function CreatedToken({
  token,
  onDone,
}: {
  token: CreatedAccessToken;
  onDone: () => void;
}) {
  return (
    <Stack gap="md">
      <Alert color="yellow" variant="light">
        Copie o token agora: ele não será mostrado novamente.
      </Alert>
      <TextInput
        label="Token"
        value={token.token}
        readOnly
        rightSection={<CopyAction value={token.token} label="Copiar token" />}
      />
      <Snippet
        title="Comando do Claude Code"
        text={claudeSnippet(token.token)}
      />
      <Snippet
        title="Bloco do Codex (~/.codex/config.toml)"
        text={codexSnippet(token.token)}
        testId="codex-snippet"
      />
      <Button onClick={onDone} fullWidth>
        Concluir
      </Button>
    </Stack>
  );
}

function ConfirmRevocation({
  token,
  onCancel,
  onRevoked,
}: {
  token: AccessToken;
  onCancel: () => void;
  onRevoked: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: () => api.revokeAccessToken(token.id),
    onSuccess: async () => {
      await invalidateAccessTokens(queryClient);
      onRevoked();
    },
  });

  return (
    <Stack gap="md">
      {revoke.error && (
        <Alert color="red" variant="light">
          {errorMessage(revoke.error)}
        </Alert>
      )}
      <Text>
        <Text span fw={600} c="bright">
          {token.name}
        </Text>{" "}
        será revogado e o agente que o usa perderá o acesso. Isso não pode ser
        desfeito.
      </Text>
      <DialogActions>
        <Button variant="default" onClick={onCancel} data-autofocus>
          Cancelar
        </Button>
        <Button
          color="red"
          loading={revoke.isPending}
          onClick={() => revoke.mutate()}
        >
          Revogar token
        </Button>
      </DialogActions>
    </Stack>
  );
}
