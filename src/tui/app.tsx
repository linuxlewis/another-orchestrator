import { QueryClientProvider } from "@tanstack/react-query";
import { Box, useApp, useInput, useStdout } from "ink";
import { useCallback, useMemo, useState } from "react";
import type { StateManager } from "../core/state.js";
import type { TicketState } from "../core/types.js";
import type { WorkflowLoader } from "../core/workflow.js";
import { Breadcrumb } from "./components/Breadcrumb.js";
import { Footer, type Hotkey } from "./components/Footer.js";
import { Header } from "./components/Header.js";
import { useScreen } from "./hooks/useScreen.js";
import {
  usePlans,
  useStateWatcher,
  useTicketsByPlan,
} from "./hooks/useStateData.js";
import {
  getStatusHotkeys,
  useTicketActions,
} from "./hooks/useTicketActions.js";
import { useWorkflows } from "./hooks/useWorkflows.js";
import { queryClient } from "./queries/query-client.js";
import { PlansScreen } from "./screens/PlansScreen.js";
import { TicketsScreen } from "./screens/TicketsScreen.js";

interface AppProps {
  stateManager: StateManager;
  stateDir: string;
  workflowLoader?: WorkflowLoader;
}

const PLANS_HOTKEYS: Hotkey[] = [
  { key: "↑↓", label: "navigate" },
  { key: "⏎", label: "open" },
  { key: "/", label: "filter" },
  { key: "q", label: "quit" },
];

const TICKETS_NAV_HOTKEYS: Hotkey[] = [
  { key: "↑↓", label: "navigate" },
  { key: "esc", label: "back" },
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

  const { currentScreen, showPlansScreen, showTicketsScreen } = useScreen();

  const { data: plans = [] } = usePlans(stateManager);
  const { data: ticketsByPlan = new Map<string, TicketState[]>() } =
    useTicketsByPlan(stateManager, plans);

  useStateWatcher(stateDir);

  const [selectedTicketIndex, setSelectedTicketIndex] = useState(0);

  const selectedPlan =
    currentScreen.type === "tickets"
      ? plans.find((p) => p.id === currentScreen.planId)
      : undefined;
  const selectedTickets =
    currentScreen.type === "tickets"
      ? (ticketsByPlan.get(currentScreen.planId) ?? [])
      : [];
  const selectedTicket =
    currentScreen.type === "tickets"
      ? selectedTickets[selectedTicketIndex]
      : undefined;

  const workflowNames = useMemo(
    () => selectedTickets.map((t) => t.workflow),
    [selectedTickets],
  );
  const { data: workflows = new Map() } = useWorkflows(
    workflowLoader,
    workflowNames,
  );

  const { pause, resume, retry, skip, copySessionId, footerMessage } =
    useTicketActions(stateManager, selectedTicket);

  // Global keys
  useInput(
    useCallback(
      (input, key) => {
        if (input === "q") {
          exit();
        }
        if (key.escape && currentScreen.type === "tickets") {
          showPlansScreen();
        }
        // Ticket action hotkeys
        if (currentScreen.type === "tickets") {
          if (input === "p") pause();
          if (input === "R") resume();
          if (input === "r") retry();
          if (input === "s") skip();
          if (input === "c") copySessionId();
        }
      },
      [
        exit,
        currentScreen,
        showPlansScreen,
        pause,
        resume,
        retry,
        skip,
        copySessionId,
      ],
    ),
  );

  const runningCount = countRunning(ticketsByPlan);

  // Reserve lines for header (1) + breadcrumb (1) + column header (1) + footer (1) + padding (2)
  const terminalHeight = stdout?.rows ?? 24;
  const tableHeight = Math.max(1, terminalHeight - 6);

  const breadcrumbPath = useMemo(() => {
    if (currentScreen.type === "tickets" && selectedPlan) {
      return ["Plans", selectedPlan.name];
    }
    return ["Plans"];
  }, [currentScreen, selectedPlan]);

  const hotkeys = useMemo(() => {
    if (currentScreen.type === "tickets") {
      const actionHotkeys = getStatusHotkeys(selectedTicket?.status);
      return [
        ...TICKETS_NAV_HOTKEYS,
        ...actionHotkeys,
        { key: "q", label: "quit" },
      ];
    }
    return PLANS_HOTKEYS;
  }, [currentScreen, selectedTicket?.status]);

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Header planCount={plans.length} runningCount={runningCount} />
      <Breadcrumb path={breadcrumbPath} />
      <Box flexDirection="column" flexGrow={1}>
        {currentScreen.type === "tickets" && selectedPlan ? (
          <TicketsScreen
            plan={selectedPlan}
            tickets={selectedTickets}
            workflows={workflows}
            height={tableHeight}
            onSelectedChange={setSelectedTicketIndex}
          />
        ) : (
          <PlansScreen
            plans={plans}
            ticketsByPlan={ticketsByPlan}
            onSelectPlan={(planId) => {
              showTicketsScreen({ planId });
            }}
            height={tableHeight}
          />
        )}
      </Box>
      <Footer hotkeys={hotkeys} message={footerMessage} />
    </Box>
  );
}
