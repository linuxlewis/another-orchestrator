import { readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import {
  type PhaseDefinition,
  type WorkflowDefinition,
  WorkflowDefinitionSchema,
  type WorkflowRegistryEntry,
  WorkflowRegistryEntrySchema,
} from "./types.js";

const WorkflowRegistrySchema = z.object({
  workflows: z.array(WorkflowRegistryEntrySchema),
});

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

export function createWorkflowLoader(workflowDir: string): WorkflowLoader {
  const cache = new Map<string, WorkflowDefinition>();

  async function loadRegistryFile(): Promise<WorkflowRegistryEntry[]> {
    const raw = await readFile(join(workflowDir, "registry.yaml"), "utf-8");
    const parsed = YAML.parse(raw);
    const registry = WorkflowRegistrySchema.parse(parsed);
    return registry.workflows;
  }

  return {
    async loadRegistry() {
      return loadRegistryFile();
    },

    async loadWorkflow(name) {
      const cached = cache.get(name);
      if (cached) return cached;

      const entries = await loadRegistryFile();
      const entry = entries.find((e) => e.name === name);
      if (!entry) {
        throw new Error(
          `Workflow "${name}" not found in registry. Available: ${entries.map((e) => e.name).join(", ")}`,
        );
      }

      const raw = await readFile(join(workflowDir, entry.file), "utf-8");
      const parsed = YAML.parse(raw);
      const workflow = WorkflowDefinitionSchema.parse(parsed);
      cache.set(name, workflow);
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
    },
  };
}
