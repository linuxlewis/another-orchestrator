import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import YAML from "yaml";
import { type OrchestratorConfig, OrchestratorConfigSchema } from "./types.js";

export async function loadConfig(
  configPath = "orchestrator.yaml",
): Promise<OrchestratorConfig> {
  const absPath = isAbsolute(configPath) ? configPath : resolve(configPath);
  const raw = await readFile(absPath, "utf-8");
  const parsed = YAML.parse(raw);
  const config = OrchestratorConfigSchema.parse(parsed);

  const baseDir = dirname(absPath);

  return {
    ...config,
    stateDir: resolve(baseDir, config.stateDir),
    logDir: resolve(baseDir, config.logDir),
    workflowDir: resolve(baseDir, config.workflowDir),
    promptDir: resolve(baseDir, config.promptDir),
    scriptDir: resolve(baseDir, config.scriptDir),
  };
}

export function resolveAgent(
  config: OrchestratorConfig,
  phaseAgent: string | null | undefined,
  ticketAgent: string | null | undefined,
  planAgent: string | null | undefined,
): string {
  const agentName =
    phaseAgent ?? ticketAgent ?? planAgent ?? config.defaultAgent;

  if (!config.agents[agentName]) {
    throw new Error(
      `Agent "${agentName}" not found in config. Available agents: ${Object.keys(config.agents).join(", ")}`,
    );
  }

  return agentName;
}
