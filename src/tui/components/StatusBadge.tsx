import { Text } from "ink";
import type { TicketStatus } from "../../core/types.js";

const statusColors: Record<TicketStatus, string> = {
  running: "cyan",
  complete: "green",
  failed: "red",
  needs_attention: "red",
  paused: "yellow",
  queued: "gray",
  ready: "blue",
};

interface StatusBadgeProps {
  status: TicketStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Text color={statusColors[status]}>{status}</Text>;
}
