import type { PhaseResult } from "../phases/executor.js";
import { createPhaseExecutor } from "../phases/executor.js";
import { createLogger } from "../utils/logger.js";
import { createStateManager } from "./state.js";
import { createTemplateRenderer } from "./template.js";
import type { OrchestratorConfig, TicketState } from "./types.js";
import { createWorkflowLoader } from "./workflow.js";

export interface Runner {
  runSingleTicket(planId: string, ticketId: string): Promise<TicketState>;
}

export function createRunner(config: OrchestratorConfig): Runner {
  const stateManager = createStateManager(config.stateDir);
  const workflowLoader = createWorkflowLoader(config.workflowDir);
  const templateRenderer = createTemplateRenderer(config.promptDir);
  const logger = createLogger(config.logDir);
  const phaseExecutor = createPhaseExecutor(config, templateRenderer, logger);

  async function executeTicketPhase(ticket: TicketState): Promise<TicketState> {
    const plan = await stateManager.getPlan(ticket.planId);
    const planAgent = plan?.agent ?? null;

    const phase = await workflowLoader.getPhase(
      ticket.workflow,
      ticket.currentPhase,
    );

    // Check retries vs maxRetries
    const currentRetries = ticket.retries[ticket.currentPhase] ?? 0;
    if (phase.maxRetries !== undefined && currentRetries > phase.maxRetries) {
      logger.error(
        `Phase "${ticket.currentPhase}" exceeded maxRetries (${phase.maxRetries})`,
        ticket.ticketId,
      );
      return stateManager.updateTicket(ticket.planId, ticket.ticketId, {
        status: "failed",
        error: `Phase "${ticket.currentPhase}" exceeded maxRetries (${phase.maxRetries})`,
      });
    }

    const startedAt = new Date().toISOString();
    logger.phaseStart(ticket.currentPhase, ticket.ticketId);

    let result: PhaseResult;
    try {
      result = await phaseExecutor.execute(phase, ticket, planAgent);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.phaseEnd(ticket.currentPhase, ticket.ticketId, "failure");
      logger.error(`Phase error: ${errorMsg}`, ticket.ticketId);

      const completedAt = new Date().toISOString();
      const historyEntry = {
        phase: ticket.currentPhase,
        status: "failure" as const,
        startedAt,
        completedAt,
        output: errorMsg,
      };

      return stateManager.updateTicket(ticket.planId, ticket.ticketId, {
        status: "failed",
        error: errorMsg,
        phaseHistory: [...ticket.phaseHistory, historyEntry],
      });
    }

    const completedAt = new Date().toISOString();
    const durationMs =
      new Date(completedAt).getTime() - new Date(startedAt).getTime();
    logger.phaseEnd(
      ticket.currentPhase,
      ticket.ticketId,
      result.success ? "success" : "failure",
    );
    logger.info(
      `Phase "${ticket.currentPhase}" completed in ${durationMs}ms`,
      ticket.ticketId,
    );

    const historyEntry = {
      phase: ticket.currentPhase,
      status: (result.success ? "success" : "failure") as "success" | "failure",
      startedAt,
      completedAt,
      output: result.output.slice(0, 4096),
    };

    // Merge captured values into context
    const newContext = { ...ticket.context, ...result.captured };

    // Determine next state
    if (phase.type === "terminal") {
      // Terminal phase → complete or needs_attention
      const newStatus = phase.notify ? "needs_attention" : "complete";
      return stateManager.updateTicket(ticket.planId, ticket.ticketId, {
        status: newStatus,
        phaseHistory: [...ticket.phaseHistory, historyEntry],
        context: newContext,
        error: null,
      });
    }

    if (result.nextPhase === ticket.currentPhase) {
      // Retry — same phase
      const newRetries = {
        ...ticket.retries,
        [ticket.currentPhase]: currentRetries + 1,
      };
      return stateManager.updateTicket(ticket.planId, ticket.ticketId, {
        status: "ready",
        phaseHistory: [...ticket.phaseHistory, historyEntry],
        context: newContext,
        retries: newRetries,
        error: null,
      });
    }

    if (result.nextPhase) {
      // Advance to next phase
      return stateManager.updateTicket(ticket.planId, ticket.ticketId, {
        currentPhase: result.nextPhase,
        status: "ready",
        phaseHistory: [...ticket.phaseHistory, historyEntry],
        context: newContext,
        error: null,
      });
    }

    // No next phase and not terminal — phase didn't define a transition
    return stateManager.updateTicket(ticket.planId, ticket.ticketId, {
      status: result.success ? "complete" : "failed",
      phaseHistory: [...ticket.phaseHistory, historyEntry],
      context: newContext,
      error: result.success ? null : "Phase failed without a next phase",
    });
  }

  return {
    async runSingleTicket(planId, ticketId) {
      let ticket = await stateManager.getTicket(planId, ticketId);
      if (!ticket) {
        throw new Error(`Ticket "${ticketId}" not found in plan "${planId}"`);
      }

      // Set to running
      ticket = await stateManager.updateTicket(planId, ticketId, {
        status: "running",
      });

      logger.info(`Starting ticket ${ticketId}`, ticketId);

      // Loop through phases until terminal
      while (true) {
        ticket = await executeTicketPhase(ticket);

        // Re-read from disk for consistency
        const updated = await stateManager.getTicket(planId, ticketId);
        if (!updated) {
          throw new Error(`Ticket "${ticketId}" disappeared during execution`);
        }
        ticket = updated;

        // Check if we reached a terminal state
        if (
          ticket.status === "complete" ||
          ticket.status === "failed" ||
          ticket.status === "needs_attention"
        ) {
          logger.info(
            `Ticket ${ticketId} finished with status: ${ticket.status}`,
            ticketId,
          );
          break;
        }
      }

      return ticket;
    },
  };
}
