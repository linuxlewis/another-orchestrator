import { Box, Text } from "ink";

interface HeaderProps {
  live: boolean;
}

export function Header({ live }: HeaderProps) {
  return (
    <Box>
      <Box flexGrow={1}>
        <Text bold>orchestrator</Text>
      </Box>
      <Box>
        {live ? (
          <Text color="green">● live</Text>
        ) : (
          <Text dimColor>○ idle</Text>
        )}
      </Box>
    </Box>
  );
}
