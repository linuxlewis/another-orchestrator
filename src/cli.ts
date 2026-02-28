#!/usr/bin/env node
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { Command } from "commander";
import { loadConfig } from "./core/config.js";
import { createStateManager } from "./core/state.js";
import { createLogger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
  .name("orchestrator")
  .description("CLI-driven orchestrator for managing agent workflows")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold project directories and default config")
  .option("-d, --dir <path>", "Target directory", ".")
  .action(async (opts: { dir: string }) => {
    const targetDir = resolve(opts.dir);
    const dirs = ["state", "logs", "workflows", "prompts", "scripts", "skills"];

    for (const dir of dirs) {
      await mkdir(join(targetDir, dir), { recursive: true });
    }

    const defaultConfigSrc = resolve(__dirname, "..", "orchestrator.yaml");
    const defaultConfigDest = join(targetDir, "orchestrator.yaml");

    try {
      await copyFile(defaultConfigSrc, defaultConfigDest);
    } catch {
      // If the default config doesn't exist at expected location, skip
    }

    const logger = createLogger(join(targetDir, "logs"));
    logger.success(`Project initialized in ${targetDir}`);
    console.log(chalk.dim(`  Created directories: ${dirs.join(", ")}`));
  });

program
  .command("status")
  .description("Show plan and ticket status")
  .option("-p, --plan <planId>", "Show a specific plan")
  .option("--json", "Output as JSON")
  .action(async (opts: { plan?: string; json?: boolean }) => {
    const config = await loadConfig();
    const state = createStateManager(config.stateDir);

    if (opts.plan) {
      const plan = await state.getPlan(opts.plan);
      if (!plan) {
        console.error(chalk.red(`Plan "${opts.plan}" not found`));
        process.exitCode = 1;
        return;
      }

      const tickets = await state.listTickets(plan.id);

      if (opts.json) {
        console.log(JSON.stringify({ plan, tickets }, null, 2));
        return;
      }

      console.log(chalk.bold(`Plan: ${plan.name} (${plan.id})`));
      console.log(`  Status: ${colorStatus(plan.status)}`);
      console.log(`  Workflow: ${plan.workflow}`);
      console.log(`  Tickets: ${tickets.length}`);
      console.log();

      if (tickets.length > 0) {
        console.log(chalk.bold("  Tickets:"));
        for (const ticket of tickets) {
          console.log(
            `    ${ticket.ticketId} — ${colorStatus(ticket.status)} — ${ticket.title}`,
          );
        }
      }
      return;
    }

    const plans = await state.listPlans();

    if (opts.json) {
      console.log(JSON.stringify(plans, null, 2));
      return;
    }

    if (plans.length === 0) {
      console.log(chalk.dim("No plans found."));
      return;
    }

    console.log(chalk.bold("Plans:"));
    for (const plan of plans) {
      const tickets = await state.listTickets(plan.id);
      const completed = tickets.filter((t) => t.status === "complete").length;
      console.log(
        `  ${plan.id} — ${colorStatus(plan.status)} — ${plan.name} (${completed}/${tickets.length} tickets)`,
      );
    }
  });

function colorStatus(status: string): string {
  switch (status) {
    case "active":
    case "running":
      return chalk.cyan(status);
    case "complete":
      return chalk.green(status);
    case "failed":
    case "needs_attention":
      return chalk.red(status);
    case "paused":
      return chalk.yellow(status);
    case "queued":
      return chalk.dim(status);
    case "ready":
      return chalk.blue(status);
    default:
      return status;
  }
}

program.parse();
