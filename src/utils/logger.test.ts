import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  let logDir: string;

  beforeEach(() => {
    logDir = join(
      tmpdir(),
      `logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(logDir, { recursive: true, force: true });
  });

  it("logs info to console", () => {
    const logger = createLogger(logDir);
    logger.info("test message");
    expect(console.log).toHaveBeenCalledOnce();
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain("INFO");
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain("test message");
  });

  it("logs with ticketId tag in console", () => {
    const logger = createLogger(logDir);
    logger.info("msg", "ticket-1");
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain("[ticket-1]");
  });

  it("writes to file when ticketId is provided", async () => {
    const logger = createLogger(logDir);
    logger.info("file message", "ticket-2");
    // Wait for async file write
    await new Promise((r) => setTimeout(r, 100));
    const content = await readFile(join(logDir, "ticket-2.log"), "utf-8");
    expect(content).toContain("[INFO]");
    expect(content).toContain("file message");
  });

  it("does not write to file when ticketId is omitted", async () => {
    const logger = createLogger(logDir);
    logger.info("no file");
    await new Promise((r) => setTimeout(r, 100));
    await expect(
      readFile(join(logDir, "undefined.log"), "utf-8"),
    ).rejects.toThrow();
  });

  it("logs warn with yellow level", () => {
    const logger = createLogger(logDir);
    logger.warn("warning!");
    expect(console.log).toHaveBeenCalledOnce();
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain("WARN");
  });

  it("logs error with red level", () => {
    const logger = createLogger(logDir);
    logger.error("error!");
    expect(console.log).toHaveBeenCalledOnce();
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain("ERROR");
  });

  it("logs success with green level", () => {
    const logger = createLogger(logDir);
    logger.success("done!");
    expect(console.log).toHaveBeenCalledOnce();
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain("SUCCESS");
  });

  it("phaseStart logs to console and file", async () => {
    const logger = createLogger(logDir);
    logger.phaseStart("build", "ticket-3");
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain("build");
    await new Promise((r) => setTimeout(r, 100));
    const content = await readFile(join(logDir, "ticket-3.log"), "utf-8");
    expect(content).toContain("build");
  });

  it("phaseEnd logs success status", () => {
    const logger = createLogger(logDir);
    logger.phaseEnd("build", "ticket-4", "success");
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain("SUCCESS");
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain("build");
  });

  it("phaseEnd logs failure status", () => {
    const logger = createLogger(logDir);
    logger.phaseEnd("build", "ticket-5", "failure");
    expect(vi.mocked(console.log).mock.calls[0][0]).toContain("ERROR");
  });

  it("agentOutput writes only to file", async () => {
    const logger = createLogger(logDir);
    logger.agentOutput("ticket-6", "agent says hello");
    expect(console.log).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 100));
    const content = await readFile(join(logDir, "ticket-6.log"), "utf-8");
    expect(content).toContain("[AGENT]");
    expect(content).toContain("agent says hello");
  });
});
