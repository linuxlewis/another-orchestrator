import { QueryClientProvider } from "@tanstack/react-query";
import { Box, useApp, useInput, useStdout } from "ink";
import { useCallback, useMemo, useRef, useState } from "react";
import type { StateManager } from "../core/state.js";
import type { TicketState, WorkflowDefinition } from "../core/types.js";
import type { WorkflowLoader } from "../core/workflow.js";
import { Breadcrumb } from "./components/Breadcrumb.js";
import { Footer, type Hotkey } from "./components/Footer.js";
import { Header } from "./components/Header.js";
import {
  usePlans,
  useStateWatcher,
  useTicketsByPlan,
} from "./hooks/useStateData.js";
import { queryClient } from "./queries/query-client.js";
import { PlansScreen } from "./screens/PlansScreen.js";
import { TicketsScreen } from "./screens/TicketsScreen.js";

interface AppProps {
  stateManager: StateManager;
  stateDir: string;
  workflowLoader?: WorkflowLoader;
}

type Screen = { type: "plans" } | { type: "tickets"; planId: string };

const PLANS_HOTKEYS: Hotkey[] = [
  { key: "↑↓", label: "navigate" },
  { key: "⏎", label: "open" },
  { key: "/", label: "filter" },
  { key: "q", label: "quit" },
];

const TICKETS_HOTKEYS: Hotkey[] = [
  { key: "↑↓", label: "navigate" },
  { key: "⏎", label: "open" },
  { key: "esc", label: "back" },
  { key: "/", label: "filter" },
  { key: "q", label: "quit" },
];

function countRunning(ticketsByPlan: Map<string, TicketState[]>): number {
  return Array.from(ticketsByPlan.values()).reduce(
    (count, tickets) =>
      count + tickets.filter((t) => t.status === "running").length,
    0,
  );
}

export function App({ stateManager, stateDir, workflowLoader }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner
        stateManager={stateManager}
        stateDir={stateDir}
        workflowLoader={workflowLoader}
      />
    </QueryClientProvider>
  );
}

function AppInner({ stateManager, stateDir, workflowLoader }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [screen, setScreen] = useState<Screen>({ type: "plans" });
  const [workflows, setWorkflows] = useState<Map<string, WorkflowDefinition>>(
    new Map(),
  );

  const { data: plans = [] } = usePlans(stateManager);
  const { data: ticketsByPlan = new Map<string, TicketState[]>() } =
    useTicketsByPlan(stateManager, plans);

  useStateWatcher(stateDir);

  // Track which workflows are loading/loaded to avoid duplicate fetches
  const loadedWorkflows = useRef(new Set<string>());

  const ensureWorkflow = useCallback(
    async (workflowName: string) => {
      if (!workflowLoader || loadedWorkflows.current.has(workflowName)) return;
      loadedWorkflows.current.add(workflowName);
      try {
        const wf = await workflowLoader.loadWorkflow(workflowName);
        setWorkflows((prev) => {
          const next = new Map(prev);
          next.set(workflowName, wf);
          return next;
        });
      } catch {
        // Workflow not found — ignore
      }
    },
    [workflowLoader],
  );

  // Load workflows for all tickets of the selected plan
  const selectedPlan =
    screen.type === "tickets"
      ? plans.find((p) => p.id === screen.planId)
      : undefined;
  const selectedTickets =
    screen.type === "tickets" ? (ticketsByPlan.get(screen.planId) ?? []) : [];

  // Eagerly load workflows for visible tickets
  useMemo(() => {
    const workflowNames = new Set(selectedTickets.map((t) => t.workflow));
    for (const name of workflowNames) {
      ensureWorkflow(name);
    }
  }, [selectedTickets, ensureWorkflow]);

  // Global keys
  useInput(
    useCallback(
      (input, key) => {
        if (input === "q") {
          exit();
        }
        if (key.escape && screen.type === "tickets") {
          setScreen({ type: "plans" });
        }
      },
      [exit, screen],
    ),
  );

  const runningCount = countRunning(ticketsByPlan);

  // Reserve lines for header (1) + breadcrumb (1) + column header (1) + footer (1) + padding (2)
  const terminalHeight = stdout?.rows ?? 24;
  const tableHeight = Math.max(1, terminalHeight - 6);

  const breadcrumbPath = useMemo(() => {
    if (screen.type === "tickets" && selectedPlan) {
      return ["Plans", selectedPlan.name];
    }
    return ["Plans"];
  }, [screen, selectedPlan]);

  const hotkeys = screen.type === "tickets" ? TICKETS_HOTKEYS : PLANS_HOTKEYS;

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Header planCount={plans.length} runningCount={runningCount} />
      <Breadcrumb path={breadcrumbPath} />
      <Box flexDirection="column" flexGrow={1}>
        {screen.type === "tickets" && selectedPlan ? (
          <TicketsScreen
            plan={selectedPlan}
            tickets={selectedTickets}
            workflows={workflows}
            height={tableHeight}
          />
        ) : (
          <PlansScreen
            plans={plans}
            ticketsByPlan={ticketsByPlan}
            onSelectPlan={(planId) => {
              setScreen({ type: "tickets", planId });
            }}
            height={tableHeight}
          />
        )}
      </Box>
      <Footer hotkeys={hotkeys} />
    </Box>
  );
}
