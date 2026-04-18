import { Box, useApp, useInput } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StateManager } from "../core/state.js";
import type {
  PlanFile,
  TicketState,
  WorkflowDefinition,
} from "../core/types.js";
import type { WorkflowLoader } from "../core/workflow.js";
import { Breadcrumb } from "./components/Breadcrumb.js";
import { Footer } from "./components/Footer.js";
import { Header } from "./components/Header.js";
import { PlansScreen } from "./screens/PlansScreen.js";
import { TicketsScreen } from "./screens/TicketsScreen.js";

type Screen = { type: "plans" } | { type: "tickets"; planId: string };

interface AppProps {
  stateManager: StateManager;
  workflowLoader: WorkflowLoader;
  stateDir: string;
}

export function App({ stateManager, workflowLoader, stateDir }: AppProps) {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>({ type: "plans" });
  const [plans, setPlans] = useState<PlanFile[]>([]);
  const [ticketsByPlan, setTicketsByPlan] = useState<
    Map<string, TicketState[]>
  >(new Map());
  const [workflows, setWorkflows] = useState<Map<string, WorkflowDefinition>>(
    new Map(),
  );
  const workflowsRef = useRef(workflows);
  workflowsRef.current = workflows;
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const allPlans = await stateManager.listPlans();
      setPlans(allPlans);

      const newTicketsByPlan = new Map<string, TicketState[]>();
      const newWorkflows = new Map<string, WorkflowDefinition>(
        workflowsRef.current,
      );

      for (const plan of allPlans) {
        const tickets = await stateManager.listTickets(plan.id);
        newTicketsByPlan.set(plan.id, tickets);

        // Load workflow for each ticket if not already cached
        for (const ticket of tickets) {
          if (!newWorkflows.has(ticket.workflow)) {
            try {
              const wf = await workflowLoader.loadWorkflow(ticket.workflow);
              newWorkflows.set(ticket.workflow, wf);
            } catch {
              // workflow not found — skip
            }
          }
        }
      }

      setTicketsByPlan(newTicketsByPlan);
      setWorkflows(newWorkflows);
      setLive(true);
    } catch {
      setLive(false);
    }
  }, [stateManager, workflowLoader]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // File watcher for live updates
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    async function startWatcher() {
      const { watch } = await import("chokidar");
      const watcher = watch(stateDir, {
        ignoreInitial: true,
        depth: 4,
      });

      watcher.on("all", () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          refresh();
        }, 150);
      });

      return () => {
        watcher.close();
        if (debounceTimer) clearTimeout(debounceTimer);
      };
    }

    let cleanup: (() => void) | undefined;
    startWatcher().then((c) => {
      cleanup = c;
    });

    return () => {
      cleanup?.();
    };
  }, [stateDir, refresh]);

  // Global quit key
  useInput((input) => {
    if (input === "q" && screen.type === "plans") {
      exit();
    }
  });

  const currentPlan =
    screen.type === "tickets"
      ? plans.find((p) => p.id === screen.planId)
      : undefined;

  const hints =
    screen.type === "plans"
      ? [
          { key: "\u2191\u2193", label: "navigate" },
          { key: "\u23CE", label: "open" },
          { key: "q", label: "quit" },
        ]
      : [
          { key: "\u2191\u2193", label: "navigate" },
          { key: "Esc", label: "back" },
        ];

  return (
    <Box flexDirection="column">
      <Header live={live} />
      <Breadcrumb planName={currentPlan?.name} />
      <Box flexDirection="column" flexGrow={1}>
        {screen.type === "plans" && (
          <PlansScreen
            plans={plans}
            ticketsByPlan={ticketsByPlan}
            onSelectPlan={(planId) => setScreen({ type: "tickets", planId })}
          />
        )}
        {screen.type === "tickets" && currentPlan && (
          <TicketsScreen
            plan={currentPlan}
            tickets={ticketsByPlan.get(currentPlan.id) ?? []}
            workflows={workflows}
            onBack={() => setScreen({ type: "plans" })}
          />
        )}
      </Box>
      <Footer hints={hints} />
    </Box>
  );
}
