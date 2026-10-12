import { Text, type TextProps } from "@mantine/core";

export function Wordmark(props: TextProps) {
  return (
    <Text fw={700} fz="lg" c="yellow" {...props}>
      Mensal
    </Text>
  );
}
