import { Box, Text } from "ink";

interface BreadcrumbProps {
  planName?: string;
}

export function Breadcrumb({ planName }: BreadcrumbProps) {
  const parts: string[] = ["Plans"];
  if (planName) parts.push(planName);

  return (
    <Box>
      {parts.map((part, i) => (
        <Text key={part}>
          {i > 0 && <Text dimColor> › </Text>}
          {i === parts.length - 1 ? (
            <Text bold>{part}</Text>
          ) : (
            <Text dimColor>{part}</Text>
          )}
        </Text>
      ))}
    </Box>
  );
}
