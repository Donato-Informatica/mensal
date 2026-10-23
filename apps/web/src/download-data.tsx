import { Button, Group, Text } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import type { DownloadedFile } from "./api-client.ts";
import { saveFile } from "./save-file.ts";
import { Toast } from "./toast.tsx";

/**
 * Downloads the archive of everything the user entered (PRD §6.5, §7.14):
 * `start` asks the API to build it and saves it once it arrives. `building`
 * holds meanwhile. `failed` holds from a failure until a try succeeds or the
 * failure is dismissed, so a retry in flight keeps its notice.
 */
export function useDataDownload() {
  const { api } = useRouteContext({ from: rootRouteId });
  const [failed, setFailed] = useState(false);
  const download = useMutation({
    mutationKey: ["download-data"],
    mutationFn: (): Promise<DownloadedFile> => api.downloadData(),
    onSuccess: ({ blob, fileName }) => {
      setFailed(false);
      saveFile(blob, fileName);
    },
    onError: () => setFailed(true),
  });
  return {
    building: download.isPending,
    failed,
    /** Starts a download; `onSettled` runs once it has succeeded or failed. */
    start: (onSettled?: () => void) =>
      download.mutate(undefined, onSettled && { onSettled }),
    dismiss: () => setFailed(false),
  };
}

export type DataDownload = ReturnType<typeof useDataDownload>;

/**
 * Says a download of the user's data failed, at the bottom of the screen,
 * with a retry and a way to dismiss it.
 */
export function DataDownloadFailure({ download }: { download: DataDownload }) {
  if (!download.failed) return null;
  return (
    <Toast
      role="alert"
      message={
        <Text span fw={600} c="var(--mensal-color-rose-text)">
          Não foi possível baixar seus dados.
        </Text>
      }
      actions={
        <Group gap={4} wrap="nowrap">
          <Button
            variant="subtle"
            size="xs"
            h={{ base: 44, sm: 30 }}
            loading={download.building}
            onClick={() => download.start()}
          >
            Tentar novamente
          </Button>
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            h={{ base: 44, sm: 30 }}
            disabled={download.building}
            onClick={download.dismiss}
          >
            Fechar
          </Button>
        </Group>
      }
    />
  );
}
