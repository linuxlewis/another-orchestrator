import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import {
  type PhaseDefinition,
  type WorkflowDefinition,
  WorkflowDefinitionSchema,
  type WorkflowRegistryEntry,
} from "./types.js";

export interface WorkflowLoader {
  loadRegistry(): Promise<WorkflowRegistryEntry[]>;
  loadWorkflow(name: string): Promise<WorkflowDefinition>;
  getPhase(workflowName: string, phaseId: string): Promise<PhaseDefinition>;
  getNextPhase(
    workflowName: string,
    phaseId: string,
    outcome: "success" | "failure",
  ): Promise<string | null>;
  clearCache(): void;
}

export function createWorkflowLoader(workflowDirs: string[]): WorkflowLoader {
  const cache = new Map<string, WorkflowDefinition>();
  let scanned = false;

  async function scanWorkflows(): Promise<void> {
    if (scanned) return;

    // Process dirs in order: first dir has highest priority.
    // Later dirs only add workflows not already discovered.
    for (const dir of workflowDirs) {
      let files: string[];
      try {
        files = await readdir(dir);
      } catch {
        continue; // dir may not exist
      }

      for (const file of files) {
        if (!file.endsWith(".yaml") && !file.endsWith(".yml")) continue;

        let raw: string;
        try {
          raw = await readFile(join(dir, file), "utf-8");
        } catch {
          continue;
        }

        const parsed = YAML.parse(raw);

        // Skip files that don't look like workflow definitions
        if (!parsed?.name || !parsed?.phases) continue;

        const workflow = WorkflowDefinitionSchema.parse(parsed);
        if (!cache.has(workflow.name)) {
          cache.set(workflow.name, workflow);
        }
      }
    }

    scanned = true;
  }

  return {
    async loadRegistry() {
      await scanWorkflows();
      return [...cache.values()].map((w) => ({
        name: w.name,
        description: w.description,
        tags: w.tags,
      }));
    },

    async loadWorkflow(name) {
      await scanWorkflows();
      const workflow = cache.get(name);
      if (!workflow) {
        const available = [...cache.keys()].join(", ");
        throw new Error(
          `Workflow "${name}" not found. Available: ${available}`,
        );
      }
      return workflow;
    },

    async getPhase(workflowName, phaseId) {
      const workflow = await this.loadWorkflow(workflowName);
      const phase = workflow.phases.find((p) => p.id === phaseId);
      if (!phase) {
        throw new Error(
          `Phase "${phaseId}" not found in workflow "${workflowName}"`,
        );
      }
      return phase;
    },

    async getNextPhase(workflowName, phaseId, outcome) {
      const phase = await this.getPhase(workflowName, phaseId);
      if (outcome === "success") {
        return phase.onSuccess ?? null;
      }
      return phase.onFailure ?? null;
    },

    clearCache() {
      cache.clear();
      scanned = false;
    },
  };
}
