import { describe, expect, it } from "vitest";
import { getStatusHotkeys } from "./useTicketActions.js";

describe("getStatusHotkeys", () => {
  it("shows pause for running tickets", () => {
    const hotkeys = getStatusHotkeys("running");
    expect(hotkeys).toContainEqual({ key: "p", label: "pause" });
    expect(hotkeys).not.toContainEqual(expect.objectContaining({ key: "R" }));
    expect(hotkeys).not.toContainEqual(expect.objectContaining({ key: "r" }));
    expect(hotkeys).not.toContainEqual(expect.objectContaining({ key: "s" }));
  });

  it("shows resume for paused tickets", () => {
    const hotkeys = getStatusHotkeys("paused");
    expect(hotkeys).toContainEqual({ key: "R", label: "resume" });
    expect(hotkeys).not.toContainEqual(expect.objectContaining({ key: "p" }));
  });

  it("shows retry and skip for failed tickets", () => {
    const hotkeys = getStatusHotkeys("failed");
    expect(hotkeys).toContainEqual({ key: "r", label: "retry" });
    expect(hotkeys).toContainEqual({ key: "s", label: "skip" });
  });

  it("shows skip for needs_attention tickets", () => {
    const hotkeys = getStatusHotkeys("needs_attention");
    expect(hotkeys).toContainEqual({ key: "s", label: "skip" });
    expect(hotkeys).not.toContainEqual(expect.objectContaining({ key: "r" }));
  });

  it("shows only copy session for queued tickets", () => {
    const hotkeys = getStatusHotkeys("queued");
    expect(hotkeys).toEqual([{ key: "c", label: "copy session" }]);
  });

  it("shows only copy session for complete tickets", () => {
    const hotkeys = getStatusHotkeys("complete");
    expect(hotkeys).toEqual([{ key: "c", label: "copy session" }]);
  });

  it("always includes copy session hotkey", () => {
    for (const status of [
      "running",
      "paused",
      "failed",
      "needs_attention",
      "queued",
      "complete",
      "ready",
    ] as const) {
      const hotkeys = getStatusHotkeys(status);
      expect(hotkeys).toContainEqual({ key: "c", label: "copy session" });
    }
  });

  it("handles undefined status", () => {
    const hotkeys = getStatusHotkeys(undefined);
    expect(hotkeys).toEqual([{ key: "c", label: "copy session" }]);
  });
});
