import chalk from "chalk";
import type { Command } from "commander";
import type { LoadConfigOptions } from "../core/config.js";
import { loadConfig } from "../core/config.js";
import { createStateManager } from "../core/state.js";

export function register(
  program: Command,
  getConfigOptions: () => LoadConfigOptions,
): void {
  program
    .command("pause")
    .description("Pause a running ticket")
    .argument("<planId>", "Plan ID")
    .argument("<ticketId>", "Ticket ID")
    .action(async (planId: string, ticketId: string) => {
      const config = await loadConfig(getConfigOptions());
      const state = createStateManager(config.stateDir);
      await state.updateTicket(planId, ticketId, { status: "paused" });
      console.log(chalk.green(`Paused ticket ${ticketId} in plan ${planId}`));
    });

  program
    .command("resume")
    .description("Resume a paused ticket")
    .argument("<planId>", "Plan ID")
    .argument("<ticketId>", "Ticket ID")
    .action(async (planId: string, ticketId: string) => {
      const config = await loadConfig(getConfigOptions());
      const state = createStateManager(config.stateDir);
      await state.updateTicket(planId, ticketId, { status: "ready" });
      console.log(chalk.green(`Resumed ticket ${ticketId} in plan ${planId}`));
    });

  program
    .command("skip")
    .description("Skip to a specific phase for a ticket")
    .argument("<planId>", "Plan ID")
    .argument("<ticketId>", "Ticket ID")
    .argument("<phase>", "Phase to skip to")
    .action(async (planId: string, ticketId: string, phase: string) => {
      const config = await loadConfig(getConfigOptions());
      const state = createStateManager(config.stateDir);
      await state.updateTicket(planId, ticketId, {
        currentPhase: phase,
        status: "ready",
      });
      console.log(
        chalk.green(
          `Skipped ticket ${ticketId} in plan ${planId} to phase ${phase}`,
        ),
      );
    });

  program
    .command("retry")
    .description("Retry a failed ticket from its current phase")
    .argument("<planId>", "Plan ID")
    .argument("<ticketId>", "Ticket ID")
    .action(async (planId: string, ticketId: string) => {
      const config = await loadConfig(getConfigOptions());
      const state = createStateManager(config.stateDir);
      const ticket = await state.getTicket(planId, ticketId);
      if (!ticket) {
        console.error(chalk.red(`Ticket "${ticketId}" not found`));
        process.exitCode = 1;
        return;
      }
      const newRetries = { ...ticket.retries, [ticket.currentPhase]: 0 };
      await state.updateTicket(planId, ticketId, {
        retries: newRetries,
        status: "ready",
        error: null,
      });
      console.log(
        chalk.green(
          `Retrying ticket ${ticketId} from phase ${ticket.currentPhase}`,
        ),
      );
    });

  program
    .command("pause-plan")
    .description("Pause an entire plan")
    .argument("<planId>", "Plan ID")
    .action(async (planId: string) => {
      const config = await loadConfig(getConfigOptions());
      const state = createStateManager(config.stateDir);
      const plan = await state.getPlan(planId);
      if (!plan) {
        console.error(chalk.red(`Plan "${planId}" not found`));
        process.exitCode = 1;
        return;
      }
      await state.savePlan({ ...plan, status: "paused" });
      console.log(chalk.green(`Paused plan ${planId}`));
    });

  program
    .command("resume-plan")
    .description("Resume a paused plan")
    .argument("<planId>", "Plan ID")
    .action(async (planId: string) => {
      const config = await loadConfig(getConfigOptions());
      const state = createStateManager(config.stateDir);
      const plan = await state.getPlan(planId);
      if (!plan) {
        console.error(chalk.red(`Plan "${planId}" not found`));
        process.exitCode = 1;
        return;
      }
      await state.savePlan({ ...plan, status: "active" });
      console.log(chalk.green(`Resumed plan ${planId}`));
    });
}
