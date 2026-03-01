import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkflowLoader } from "./workflow.js";

describe("workflow", () => {
  let tmpDir: string;

  const registryYaml = `
workflows:
  - name: minimal
    file: minimal.yaml
    description: "Minimal workflow"
    tags:
      - test
  - name: full
    file: full.yaml
    description: "Full workflow"
    tags:
      - production
`;

  const minimalYaml = `
name: minimal
description: "Minimal test workflow"
phases:
  - id: run_script
    type: script
    command: run.sh
    args:
      - "{{ branch }}"
    maxRetries: 2
    capture:
      script_output: stdout
    onSuccess: complete
    onFailure: abort
  - id: complete
    type: terminal
  - id: abort
    type: terminal
    notify: true
`;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "workflow-test-"));
    await writeFile(join(tmpDir, "registry.yaml"), registryYaml);
    await writeFile(join(tmpDir, "minimal.yaml"), minimalYaml);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("loadRegistry", () => {
    it("loads and parses registry.yaml", async () => {
      const loader = createWorkflowLoader(tmpDir);
      const entries = await loader.loadRegistry();
      expect(entries).toHaveLength(2);
      expect(entries[0].name).toBe("minimal");
      expect(entries[1].name).toBe("full");
    });
  });

  describe("loadWorkflow", () => {
    it("loads and parses a workflow YAML", async () => {
      const loader = createWorkflowLoader(tmpDir);
      const workflow = await loader.loadWorkflow("minimal");
      expect(workflow.name).toBe("minimal");
      expect(workflow.phases).toHaveLength(3);
      expect(workflow.phases[0].id).toBe("run_script");
      expect(workflow.phases[0].type).toBe("script");
    });

    it("caches loaded workflows", async () => {
      const loader = createWorkflowLoader(tmpDir);
      const wf1 = await loader.loadWorkflow("minimal");
      const wf2 = await loader.loadWorkflow("minimal");
      expect(wf1).toBe(wf2); // same reference = cached
    });

    it("throws for missing workflow", async () => {
      const loader = createWorkflowLoader(tmpDir);
      await expect(loader.loadWorkflow("nonexistent")).rejects.toThrow(
        'Workflow "nonexistent" not found in registry',
      );
    });
  });

  describe("getPhase", () => {
    it("returns a specific phase definition", async () => {
      const loader = createWorkflowLoader(tmpDir);
      const phase = await loader.getPhase("minimal", "run_script");
      expect(phase.id).toBe("run_script");
      expect(phase.type).toBe("script");
      expect(phase.command).toBe("run.sh");
    });

    it("throws for missing phase", async () => {
      const loader = createWorkflowLoader(tmpDir);
      await expect(loader.getPhase("minimal", "missing")).rejects.toThrow(
        'Phase "missing" not found in workflow "minimal"',
      );
    });
  });

  describe("getNextPhase", () => {
    it("returns onSuccess target", async () => {
      const loader = createWorkflowLoader(tmpDir);
      const next = await loader.getNextPhase(
        "minimal",
        "run_script",
        "success",
      );
      expect(next).toBe("complete");
    });

    it("returns onFailure target", async () => {
      const loader = createWorkflowLoader(tmpDir);
      const next = await loader.getNextPhase(
        "minimal",
        "run_script",
        "failure",
      );
      expect(next).toBe("abort");
    });

    it("returns null when no transition defined", async () => {
      const loader = createWorkflowLoader(tmpDir);
      const next = await loader.getNextPhase("minimal", "complete", "success");
      expect(next).toBeNull();
    });
  });

  describe("clearCache", () => {
    it("clears cached workflows so they reload from disk", async () => {
      const loader = createWorkflowLoader(tmpDir);
      await loader.loadWorkflow("minimal");

      // Modify the file on disk
      const updatedYaml = minimalYaml.replace(
        "Minimal test workflow",
        "Updated workflow",
      );
      await writeFile(join(tmpDir, "minimal.yaml"), updatedYaml);

      // Should still return cached
      const wf2 = await loader.loadWorkflow("minimal");
      expect(wf2.description).toBe("Minimal test workflow");

      // Clear and reload
      loader.clearCache();
      const wf3 = await loader.loadWorkflow("minimal");
      expect(wf3.description).toBe("Updated workflow");
    });
  });

  describe("invalid YAML", () => {
    it("throws on invalid workflow YAML", async () => {
      await writeFile(
        join(tmpDir, "registry.yaml"),
        `
workflows:
  - name: bad
    file: bad.yaml
    description: "Bad workflow"
    tags: []
`,
      );
      await writeFile(join(tmpDir, "bad.yaml"), "name: 123\nphases: not-array");
      const loader = createWorkflowLoader(tmpDir);
      await expect(loader.loadWorkflow("bad")).rejects.toThrow();
    });
  });
});
