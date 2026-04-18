import { Box, Text } from "ink";

interface FooterProps {
  hints: Array<{ key: string; label: string }>;
}

export function Footer({ hints }: FooterProps) {
  return (
    <Box>
      {hints.map((hint, i) => (
        <Text key={hint.key}>
          {i > 0 && <Text> </Text>}
          <Text bold>{hint.key}</Text>
          <Text dimColor> {hint.label}</Text>
        </Text>
      ))}
    </Box>
  );
}
