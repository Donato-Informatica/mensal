import { Box, Center, Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./card-screen.module.css";

/**
 * The narrow centered card the screens outside the app proper sit in, with the
 * lockup stacked large beside it (above it on phones). The mark is decorative;
 * the text names the app.
 */
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
      <div className={classes.layout}>
        <Stack align="center" gap="sm">
          <Box
            component="img"
            src="/logo.svg"
            alt=""
            display="block"
            w={{ base: 80, sm: 160 }}
            h={{ base: 80, sm: 160 }}
          />
          <Text fw={700} fz={{ base: 24, sm: 32 }} lh={1.2} lts={-1} c="yellow">
            Mensal
          </Text>
        </Stack>
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
      </div>
    </Center>
  );
}
