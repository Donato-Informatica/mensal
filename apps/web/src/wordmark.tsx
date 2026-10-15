import { Group, Text, type GroupProps } from "@mantine/core";

/**
 * The lockup: the logo mark, then "Mensal". The mark is decorative; the text
 * names the app.
 */
export function Wordmark({
  markSize,
  ...props
}: GroupProps & { markSize: number }) {
  return (
    <Group gap="xs" wrap="nowrap" {...props}>
      <img src="/logo.svg" alt="" width={markSize} height={markSize} />
      <Text fw={700} fz="lg" c="var(--mensal-color-wordmark)">
        Mensal
      </Text>
    </Group>
  );
}
