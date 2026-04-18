import { Text } from "ink";
import { useState } from "react";
import type {
  PlanFile,
  TicketState,
  WorkflowDefinition,
} from "../../core/types.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { type Column, Table } from "../components/Table.js";
import { formatAge } from "../utils.js";

const phaseTypeColors: Record<string, string> = {
  agent: "#818cf8",
  script: "#a3e635",
  poll: "#e879f9",
  terminal: "yellow",
};

interface TicketRow {
  ticket: TicketState;
  blockedBy: string | null;
  phaseDisplay: React.ReactNode;
  totalRetries: number;
}

interface TicketsScreenProps {
  plan: PlanFile;
  tickets: TicketState[];
  workflows: Map<string, WorkflowDefinition>;
  onBack: () => void;
}

function buildPhaseDisplay(
  ticket: TicketState,
  workflows: Map<string, WorkflowDefinition>,
): React.ReactNode {
  const workflow = workflows.get(ticket.workflow);
  if (!workflow) {
    return <Text dimColor>{ticket.currentPhase}</Text>;
  }

  const phaseIndex = workflow.phases.findIndex(
    (p) => p.id === ticket.currentPhase,
  );
  if (phaseIndex === -1) {
    return <Text dimColor>{ticket.currentPhase}</Text>;
  }

  const phase = workflow.phases[phaseIndex];
  const color = phaseTypeColors[phase.type] ?? "white";
  const label = `${phase.type} ${phaseIndex + 1}/${workflow.phases.length}`;

  return <Text color={color}>{label}</Text>;
}

export function TicketsScreen({
  plan,
  tickets,
  workflows,
  onBack,
}: TicketsScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const blockedByMap = new Map<string, string[]>();
  for (const entry of plan.tickets) {
    if (entry.blockedBy.length > 0) {
      blockedByMap.set(entry.ticketId, entry.blockedBy);
    }
  }

  const rows: TicketRow[] = tickets.map((ticket) => ({
    ticket,
    blockedBy: blockedByMap.get(ticket.ticketId)?.[0] ?? null,
    phaseDisplay: buildPhaseDisplay(ticket, workflows),
    totalRetries: Object.values(ticket.retries).reduce((a, b) => a + b, 0),
  }));

  const columns: Column<TicketRow>[] = [
    {
      title: "TICKET",
      width: 24,
      render: (r) => r.ticket.ticketId,
    },
    {
      title: "STATUS",
      width: 18,
      render: (r) => <StatusBadge status={r.ticket.status} />,
    },
    {
      title: "PHASE",
      width: 20,
      render: (r) => r.phaseDisplay,
    },
    {
      title: "RETRY",
      width: 8,
      render: (r) =>
        r.totalRetries > 0 ? (
          <Text color="yellow">{r.totalRetries}</Text>
        ) : (
          <Text dimColor>0</Text>
        ),
    },
    {
      title: "BLOCK",
      width: 16,
      render: (r) =>
        r.blockedBy ? (
          <Text>{r.blockedBy}</Text>
        ) : (
          <Text dimColor>{"\u2014"}</Text>
        ),
    },
    {
      title: "AGE",
      width: 8,
      render: (r) => {
        const history = r.ticket.phaseHistory;
        if (history.length > 0) {
          return formatAge(history[history.length - 1].startedAt);
        }
        return <Text dimColor>{"\u2014"}</Text>;
      },
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.ticket.ticketId}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      onEscape={onBack}
    />
  );
}
