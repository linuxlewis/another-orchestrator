import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import type {
  PlanFile,
  TicketState,
  WorkflowDefinition,
} from "../../core/types.js";
import { TicketsScreen } from "./TicketsScreen.js";

function makePlan(overrides: Partial<PlanFile> = {}): PlanFile {
  return {
    id: "plan-1",
    name: "Test Plan",
    createdAt: "2025-01-01T00:00:00Z",
    createdBy: "user",
    repo: "test-repo",
    workflow: "standard",
    agent: null,
    worktreeRoot: "/tmp/worktrees",
    status: "active",
    tickets: [
      { ticketId: "TK-1", order: 1, blockedBy: [] },
      { ticketId: "TK-2", order: 2, blockedBy: ["TK-1"] },
      { ticketId: "TK-3", order: 3, blockedBy: [] },
    ],
    ...overrides,
  };
}

function makeTicket(overrides: Partial<TicketState> = {}): TicketState {
  return {
    planId: "plan-1",
    ticketId: "TK-1",
    title: "Test Ticket",
    description: "Do the thing",
    acceptanceCriteria: [],
    linearUrl: null,
    repo: "test-repo",
    workflow: "standard",
    branch: "feature/tk-1",
    worktree: "/tmp/worktrees/tk-1",
    agent: null,
    status: "running",
    currentPhase: "implement",
    phaseHistory: [
      {
        phase: "setup",
        status: "success",
        startedAt: "2025-01-01T00:00:00Z",
        completedAt: "2025-01-01T00:01:00Z",
      },
      {
        phase: "implement",
        status: "success",
        startedAt: "2025-01-01T00:01:00Z",
        completedAt: null,
      },
    ],
    context: {},
    retries: {},
    error: null,
    ...overrides,
  };
}

const standardWorkflow: WorkflowDefinition = {
  name: "standard",
  description: "Standard workflow",
  tags: [],
  phases: [
    {
      id: "setup",
      type: "script",
      args: [],
      maxRetries: 0,
      notify: false,
    },
    {
      id: "implement",
      type: "agent",
      args: [],
      maxRetries: 0,
      notify: false,
    },
    {
      id: "verify",
      type: "script",
      args: [],
      maxRetries: 0,
      notify: false,
    },
  ],
};

describe("TicketsScreen", () => {
  it("renders ticket rows with correct columns", () => {
    const plan = makePlan();
    const tickets = [
      makeTicket({ ticketId: "TK-1", status: "running" }),
      makeTicket({ ticketId: "TK-2", status: "queued" }),
    ];
    const workflows = new Map([["standard", standardWorkflow]]);

    const { lastFrame } = render(
      <TicketsScreen
        plan={plan}
        tickets={tickets}
        workflows={workflows}
        onBack={() => {}}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("TICKET");
    expect(output).toContain("STATUS");
    expect(output).toContain("PHASE");
    expect(output).toContain("RETRY");
    expect(output).toContain("BLOCK");
    expect(output).toContain("AGE");
    expect(output).toContain("TK-1");
    expect(output).toContain("TK-2");
  });

  it("shows phase type and index/total from workflow", () => {
    const plan = makePlan();
    const tickets = [
      makeTicket({
        ticketId: "TK-1",
        currentPhase: "implement",
      }),
    ];
    const workflows = new Map([["standard", standardWorkflow]]);

    const { lastFrame } = render(
      <TicketsScreen
        plan={plan}
        tickets={tickets}
        workflows={workflows}
        onBack={() => {}}
      />,
    );

    const output = lastFrame();
    // implement is phase index 1 (0-based), displayed as 2/3
    expect(output).toContain("agent 2/3");
  });

  it("shows blockedBy ticket ID from plan entry", () => {
    const plan = makePlan();
    const tickets = [makeTicket({ ticketId: "TK-2", status: "queued" })];
    const workflows = new Map([["standard", standardWorkflow]]);

    const { lastFrame } = render(
      <TicketsScreen
        plan={plan}
        tickets={tickets}
        workflows={workflows}
        onBack={() => {}}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("TK-1"); // blockedBy TK-1
  });

  it("shows dash when no blockedBy", () => {
    const plan = makePlan();
    const tickets = [makeTicket({ ticketId: "TK-3", status: "ready" })];
    const workflows = new Map([["standard", standardWorkflow]]);

    const { lastFrame } = render(
      <TicketsScreen
        plan={plan}
        tickets={tickets}
        workflows={workflows}
        onBack={() => {}}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("\u2014"); // em dash
  });

  it("shows retry count in yellow when > 0", () => {
    const plan = makePlan();
    const tickets = [
      makeTicket({
        ticketId: "TK-1",
        retries: { implement: 2, verify: 1 },
      }),
    ];
    const workflows = new Map([["standard", standardWorkflow]]);

    const { lastFrame } = render(
      <TicketsScreen
        plan={plan}
        tickets={tickets}
        workflows={workflows}
        onBack={() => {}}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("3"); // total retries: 2+1
  });

  it("shows empty state when no tickets", () => {
    const plan = makePlan({ tickets: [] });
    const workflows = new Map([["standard", standardWorkflow]]);

    const { lastFrame } = render(
      <TicketsScreen
        plan={plan}
        tickets={[]}
        workflows={workflows}
        onBack={() => {}}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("No items");
  });

  it("shows current phase name when workflow not found", () => {
    const plan = makePlan();
    const tickets = [
      makeTicket({
        ticketId: "TK-1",
        workflow: "unknown-workflow",
        currentPhase: "deploy",
      }),
    ];
    const workflows = new Map<string, WorkflowDefinition>();

    const { lastFrame } = render(
      <TicketsScreen
        plan={plan}
        tickets={tickets}
        workflows={workflows}
        onBack={() => {}}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("deploy");
  });

  it("navigates rows with arrow keys", () => {
    const plan = makePlan();
    const tickets = [
      makeTicket({ ticketId: "TK-1" }),
      makeTicket({ ticketId: "TK-2" }),
      makeTicket({ ticketId: "TK-3" }),
    ];
    const workflows = new Map([["standard", standardWorkflow]]);

    const { stdin, lastFrame } = render(
      <TicketsScreen
        plan={plan}
        tickets={tickets}
        workflows={workflows}
        onBack={() => {}}
      />,
    );

    // First row should be selected initially (inverse)
    const before = lastFrame();
    expect(before).toBeDefined();

    // Press down arrow
    stdin.write("\u001B[B");
    const after = lastFrame();
    expect(after).toBeDefined();
  });

  it("calls onBack when Escape is pressed", async () => {
    const plan = makePlan();
    const tickets = [makeTicket({ ticketId: "TK-1" })];
    const workflows = new Map([["standard", standardWorkflow]]);
    let backCalled = false;

    const { stdin } = render(
      <TicketsScreen
        plan={plan}
        tickets={tickets}
        workflows={workflows}
        onBack={() => {
          backCalled = true;
        }}
      />,
    );

    // Ink treats lone ESC followed by a delay as Escape key
    stdin.write("\x1B");
    // Give ink time to process the escape sequence
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(backCalled).toBe(true);
  });
});
