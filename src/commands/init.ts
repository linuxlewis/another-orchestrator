import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import type { LoadConfigOptions } from "../core/config.js";
import { resolveOrchestratorHome } from "../core/config.js";
import { createLogger } from "../utils/logger.js";

export function register(
  program: Command,
  _getConfigOptions: () => LoadConfigOptions,
): void {
  program
    .command("init")
    .description("Create default config and directories in ~/.orchestrator")
    .option("-d, --dir <path>", "Target directory (default: ~/.orchestrator)")
    .action(async (opts: { dir?: string }) => {
      const targetDir = opts.dir
        ? resolve(opts.dir)
        : resolveOrchestratorHome();
      await mkdir(join(targetDir, "state", "logs"), { recursive: true });

      const configPath = join(targetDir, "config.yaml");
      const configContent = `defaultAgent: claude

agents:
  claude:
    command: claude
    defaultArgs:
      - "--dangerously-skip-permissions"
  codex:
    command: codex
    defaultArgs:
      - "--approval-mode"
      - "never"
  pi:
    command: pi
    defaultArgs: []

pollInterval: 10
maxConcurrency: 3
ghCommand: gh
`;
      await writeFile(configPath, configContent, { flag: "wx" }).catch(() => {
        // File already exists, don't overwrite
      });

      const logger = createLogger(join(targetDir, "state", "logs"));
      logger.success(`Initialized in ${targetDir}`);
      console.log(chalk.dim("  Created directories: state, state/logs"));
      console.log(chalk.dim(`  Config: ${configPath}`));
    });
}
