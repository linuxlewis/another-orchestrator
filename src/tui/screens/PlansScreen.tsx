import { Text } from "ink";
import { useState } from "react";
import type { PlanFile, TicketState } from "../../core/types.js";
import { type Column, Table } from "../components/Table.js";
import { formatAge } from "../utils.js";

function progressBar(completed: number, total: number): string {
  if (total === 0) return "0/0 [        ]";
  const filled = Math.round((completed / total) * 8);
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(8 - filled);
  return `${completed}/${total} [${bar}]`;
}

interface PlanRow {
  plan: PlanFile;
  tickets: TicketState[];
}

interface PlansScreenProps {
  plans: PlanFile[];
  ticketsByPlan: Map<string, TicketState[]>;
  onSelectPlan: (planId: string) => void;
}

export function PlansScreen({
  plans,
  ticketsByPlan,
  onSelectPlan,
}: PlansScreenProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const rows: PlanRow[] = plans.map((plan) => ({
    plan,
    tickets: ticketsByPlan.get(plan.id) ?? [],
  }));

  const columns: Column<PlanRow>[] = [
    {
      title: "NAME",
      width: 30,
      render: (r) => r.plan.name,
    },
    {
      title: "STATUS",
      width: 12,
      render: (r) => {
        const colors: Record<string, string> = {
          active: "cyan",
          paused: "yellow",
          complete: "green",
        };
        return <Text color={colors[r.plan.status]}>{r.plan.status}</Text>;
      },
    },
    {
      title: "PROGRESS",
      width: 20,
      render: (r) => {
        const completed = r.tickets.filter(
          (t) => t.status === "complete",
        ).length;
        return progressBar(completed, r.tickets.length);
      },
    },
    {
      title: "RUNNING",
      width: 10,
      render: (r) => {
        const count = r.tickets.filter((t) => t.status === "running").length;
        return count > 0 ? (
          <Text color="green">{count}</Text>
        ) : (
          <Text dimColor>0</Text>
        );
      },
    },
    {
      title: "FAILED",
      width: 10,
      render: (r) => {
        const count = r.tickets.filter(
          (t) => t.status === "failed" || t.status === "needs_attention",
        ).length;
        return count > 0 ? (
          <Text color="red">{count}</Text>
        ) : (
          <Text dimColor>0</Text>
        );
      },
    },
    {
      title: "AGE",
      width: 8,
      render: (r) => formatAge(r.plan.createdAt),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.plan.id}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      onEnter={(i) => {
        const row = rows[i];
        if (row) onSelectPlan(row.plan.id);
      }}
    />
  );
}
