import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig, resolveAgent } from "./config.js";
import type { OrchestratorConfig } from "./types.js";

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(
      tmpdir(),
      `config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("loads and validates a YAML config", async () => {
    const configContent = `
defaultAgent: claude
agents:
  claude:
    command: claude
    defaultArgs: []
stateDir: ./state
logDir: ./logs
workflowDir: ./workflows
promptDir: ./prompts
scriptDir: ./scripts
`;
    const configPath = join(tmpDir, "orchestrator.yaml");
    await writeFile(configPath, configContent);

    const config = await loadConfig(configPath);
    expect(config.defaultAgent).toBe("claude");
    expect(config.pollInterval).toBe(10);
    expect(config.maxConcurrency).toBe(3);
  });

  it("resolves relative paths to absolute based on config dir", async () => {
    const configContent = `
defaultAgent: claude
agents:
  claude:
    command: claude
    defaultArgs: []
stateDir: ./state
logDir: ./logs
workflowDir: ./workflows
promptDir: ./prompts
scriptDir: ./scripts
`;
    const configPath = join(tmpDir, "orchestrator.yaml");
    await writeFile(configPath, configContent);

    const config = await loadConfig(configPath);
    expect(config.stateDir).toBe(join(tmpDir, "state"));
    expect(config.logDir).toBe(join(tmpDir, "logs"));
    expect(config.workflowDir).toBe(join(tmpDir, "workflows"));
    expect(config.promptDir).toBe(join(tmpDir, "prompts"));
    expect(config.scriptDir).toBe(join(tmpDir, "scripts"));
  });

  it("throws on invalid YAML", async () => {
    const configPath = join(tmpDir, "bad.yaml");
    await writeFile(configPath, "not: [valid: yaml: {{{}}}");

    await expect(loadConfig(configPath)).rejects.toThrow();
  });

  it("throws on missing required fields", async () => {
    const configPath = join(tmpDir, "missing.yaml");
    await writeFile(configPath, "defaultAgent: claude\n");

    await expect(loadConfig(configPath)).rejects.toThrow();
  });

  it("throws on missing file", async () => {
    await expect(
      loadConfig(join(tmpDir, "nonexistent.yaml")),
    ).rejects.toThrow();
  });
});

describe("resolveAgent", () => {
  const config: OrchestratorConfig = {
    defaultAgent: "claude",
    agents: {
      claude: { command: "claude", defaultArgs: [] },
      codex: { command: "codex", defaultArgs: [] },
    },
    stateDir: "/tmp/state",
    logDir: "/tmp/logs",
    workflowDir: "/tmp/workflows",
    promptDir: "/tmp/prompts",
    scriptDir: "/tmp/scripts",
    pollInterval: 10,
    maxConcurrency: 3,
    ghCommand: "gh",
  };

  it("returns phase agent when specified", () => {
    expect(resolveAgent(config, "codex", null, null)).toBe("codex");
  });

  it("falls back to ticket agent", () => {
    expect(resolveAgent(config, null, "codex", null)).toBe("codex");
  });

  it("falls back to plan agent", () => {
    expect(resolveAgent(config, null, null, "codex")).toBe("codex");
  });

  it("falls back to default agent", () => {
    expect(resolveAgent(config, null, null, null)).toBe("claude");
  });

  it("respects priority: phase > ticket > plan > default", () => {
    expect(resolveAgent(config, "codex", "claude", "claude")).toBe("codex");
  });

  it("throws if resolved agent is not in config", () => {
    expect(() => resolveAgent(config, "unknown", null, null)).toThrow(
      'Agent "unknown" not found',
    );
  });
});
