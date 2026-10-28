import {
  Alert,
  Button,
  CopyButton,
  Modal,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { CalendarLink, CalendarLinkPayload } from "@mensal/shared";
import {
  IconBrandGoogle,
  IconCalendarPlus,
  IconCheck,
  IconCopy,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { ApiError, errorMessage } from "./api-error.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { GuideLink } from "./guide-link.tsx";

const calendarLinkKey = ["calendar-link"];

/**
 * The "Link do calendário" modal, opened from the account menu (PRD §7.18):
 * the user's calendar link (§6.6), to generate, copy, replace or deactivate.
 */
export function CalendarLinkModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Link do calendário">
      <CalendarLinkScreen onClose={onClose} />
    </Modal>
  );
}

type View =
  | { name: "show" }
  | { name: "generate"; replacing: boolean }
  | { name: "deactivate" };

function CalendarLinkScreen({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>({ name: "show" });
  const toShow = () => setView({ name: "show" });

  switch (view.name) {
    case "show":
      return (
        <ShowLink
          onClose={onClose}
          onGenerate={(replacing) => setView({ name: "generate", replacing })}
          onDeactivate={() => setView({ name: "deactivate" })}
        />
      );
    case "generate":
      return (
        <GenerateLink
          replacing={view.replacing}
          onCancel={toShow}
          onGenerated={toShow}
        />
      );
    case "deactivate":
      return <ConfirmDeactivation onCancel={toShow} onDeactivated={toShow} />;
  }
}

function ShowLink({
  onClose,
  onGenerate,
  onDeactivate,
}: {
  onClose: () => void;
  onGenerate: (replacing: boolean) => void;
  onDeactivate: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const query = useQuery({
    queryKey: calendarLinkKey,
    queryFn: () => api.calendarLink(),
  });

  if (query.isError) {
    return (
      <Stack gap="md">
        <Alert color="red" variant="light">
          {errorMessage(query.error)}
        </Alert>
        <Button variant="default" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </Stack>
    );
  }
  if (!query.data) return <Text c="dimmed">Carregando…</Text>;

  const { link } = query.data;
  if (!link) {
    return (
      <Stack gap="md">
        <Text>
          O link do calendário mostra suas contas pendentes no seu próprio
          calendário, como o Google Agenda ou o Calendário da Apple, cada uma no
          dia do vencimento.
        </Text>
        <Text>
          Ao assiná-lo, a descrição e o valor de cada conta pendente passam a
          ficar guardados também com o provedor do seu calendário.
        </Text>
        <DialogActions>
          <Button variant="default" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={() => onGenerate(false)}>Gerar link</Button>
        </DialogActions>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <LinkDetails link={link} />
      <DialogActions>
        <Button variant="light" color="red" onClick={onDeactivate}>
          Desativar
        </Button>
        <Button variant="default" onClick={() => onGenerate(true)}>
          Gerar novo link
        </Button>
      </DialogActions>
      <Button onClick={onClose} fullWidth>
        Fechar
      </Button>
    </Stack>
  );
}

/**
 * The link's URL, the three ways to subscribe to it (PRD §7.18), the two
 * caveats of §6.7 and the guide's step by step.
 */
function LinkDetails({ link }: { link: CalendarLink }) {
  const webcal = webcalUrl(link.url);
  return (
    <>
      <TextInput label="Link" value={link.url} readOnly />
      <Stack gap="xs">
        <CopyButton value={link.url}>
          {({ copied, copy }) => (
            <Button
              variant="default"
              leftSection={
                copied ? (
                  <IconCheck size={18} aria-hidden="true" />
                ) : (
                  <IconCopy size={18} aria-hidden="true" />
                )
              }
              onClick={copy}
            >
              {copied ? "Copiado" : "Copiar link"}
            </Button>
          )}
        </CopyButton>
        <Button
          component="a"
          href={webcal}
          variant="default"
          leftSection={<IconCalendarPlus size={18} aria-hidden="true" />}
        >
          Abrir no calendário do dispositivo
        </Button>
        <Button
          component="a"
          href={googleSubscribeUrl(webcal)}
          target="_blank"
          rel="noopener noreferrer"
          variant="default"
          leftSection={<IconBrandGoogle size={18} aria-hidden="true" />}
        >
          Adicionar ao Google Agenda
          <Text span size="xs" c="dimmed" ml={6}>
            (no computador)
          </Text>
        </Button>
      </Stack>
      <Text size="sm" c="dimmed">
        O Google Agenda e o Outlook ignoram o lembrete das contas, e o
        Calendário da Apple o remove, a menos que você desative “Remover
        alertas” ao assinar.
      </Text>
      <Text size="sm" c="dimmed">
        Uma conta paga ou pulada pode levar até cerca de um dia para sair do seu
        calendário.
      </Text>
      <GuideLink section="calendario">Como assinar no seu calendário</GuideLink>
    </>
  );
}

/** The link in its `webcal://` form, which device calendars open to subscribe. */
function webcalUrl(url: string): string {
  return url.replace(/^https?:\/\//, "webcal://");
}

/** Google Calendar's subscribe link for a `webcal://` URL. */
function googleSubscribeUrl(webcal: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
}

function GenerateLink({
  replacing,
  onCancel,
  onGenerated,
}: {
  replacing: boolean;
  onCancel: () => void;
  onGenerated: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const generate = useMutation({
    mutationFn: (password: string) => api.generateCalendarLink({ password }),
    onSuccess: (payload: CalendarLinkPayload) => {
      queryClient.setQueryData(calendarLinkKey, payload);
      onGenerated();
    },
  });
  // A wrong password is that field's error; anything else, the form's.
  const wrongPassword =
    generate.error instanceof ApiError &&
    generate.error.code === "INVALID_PASSWORD";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        generate.mutate(String(form.get("password")));
      }}
    >
      <Stack gap="md">
        {replacing && (
          <Alert color="yellow" variant="light">
            O link atual deixará de funcionar em todos os calendários que o
            assinaram.
          </Alert>
        )}
        {generate.error && !wrongPassword && (
          <Alert color="red" variant="light">
            {errorMessage(generate.error)}
          </Alert>
        )}
        <PasswordInput
          label="Senha atual"
          name="password"
          autoComplete="current-password"
          required
          data-autofocus
          error={wrongPassword && errorMessage(generate.error)}
          aria-invalid={wrongPassword}
          onChange={() => {
            if (wrongPassword) generate.reset();
          }}
        />
        <DialogActions>
          <Button variant="default" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={generate.isPending}>
            {replacing ? "Gerar novo link" : "Gerar link"}
          </Button>
        </DialogActions>
      </Stack>
    </form>
  );
}

function ConfirmDeactivation({
  onCancel,
  onDeactivated,
}: {
  onCancel: () => void;
  onDeactivated: () => void;
}) {
  const { api } = useRouteContext({ from: rootRouteId });
  const queryClient = useQueryClient();
  const deactivate = useMutation({
    mutationFn: () => api.revokeCalendarLink(),
    onSuccess: () => {
      queryClient.setQueryData(calendarLinkKey, { link: null });
      onDeactivated();
    },
  });

  return (
    <Stack gap="md">
      {deactivate.error && (
        <Alert color="red" variant="light">
          {errorMessage(deactivate.error)}
        </Alert>
      )}
      <Text>
        O link deixará de funcionar em todos os calendários que o assinaram, e
        suas contas sairão deles na próxima atualização. Você pode gerar um novo
        link quando quiser.
      </Text>
      <DialogActions>
        <Button variant="default" onClick={onCancel} data-autofocus>
          Cancelar
        </Button>
        <Button
          color="red"
          loading={deactivate.isPending}
          onClick={() => deactivate.mutate()}
        >
          Desativar link
        </Button>
      </DialogActions>
    </Stack>
  );
}
