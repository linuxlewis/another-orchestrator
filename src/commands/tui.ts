import type { Command } from "commander";
import type { LoadConfigOptions } from "../core/config.js";
import { loadConfig } from "../core/config.js";
import { createStateManager } from "../core/state.js";
import { createWorkflowLoader } from "../core/workflow.js";

export function register(
  program: Command,
  getConfigOptions: () => LoadConfigOptions,
): void {
  program
    .command("tui")
    .description("Launch the terminal UI for monitoring plans and tickets")
    .action(async () => {
      const config = await loadConfig(getConfigOptions());
      const stateManager = createStateManager(config.stateDir);
      const workflowLoader = createWorkflowLoader(config.workflowSearchPath);

      const { render } = await import("ink");
      const { createElement } = await import("react");
      const { App } = await import("../tui/app.js");

      render(
        createElement(App, {
          stateManager,
          workflowLoader,
          stateDir: config.stateDir,
        }),
      );
    });
}
