import { Box, Text } from "ink";
import type React from "react";

export interface Hotkey {
  key: string;
  label: string;
}

interface FooterProps {
  hotkeys: Hotkey[];
  message?: string | null;
}

export function Footer({ hotkeys, message }: FooterProps): React.ReactElement {
  if (message) {
    return (
      <Box flexDirection="row">
        <Text color="green">{message}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" gap={2}>
      {hotkeys.map((hk) => (
        <Text key={hk.key}>
          <Text bold color="cyan">
            {hk.key}
          </Text>{" "}
          <Text dimColor>{hk.label}</Text>
        </Text>
      ))}
    </Box>
  );
}
