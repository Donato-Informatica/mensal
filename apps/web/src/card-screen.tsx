import { Box, Center, Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { Wordmark } from "./wordmark.tsx";

/** The narrow centered card the screens outside the app proper sit in. */
export function CardScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Center mih="100dvh" p="md">
      <Box w="100%" maw={400}>
        <Wordmark markSize={48} mb="xl" />
        <Paper bg="dark.6" withBorder p="xl" radius="lg">
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={1}>{title}</Title>
              <Text c="dimmed" fz="sm">
                {subtitle}
              </Text>
            </Stack>
            {children}
          </Stack>
        </Paper>
      </Box>
    </Center>
  );
}
