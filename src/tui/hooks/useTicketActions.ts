import { execSync } from "node:child_process";
import { useCallback, useRef, useState } from "react";
import type { StateManager } from "../../core/state.js";
import type { TicketState, TicketStatus } from "../../core/types.js";

interface TicketActions {
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  retry: () => Promise<void>;
  skip: () => Promise<void>;
  copySessionId: () => void;
  footerMessage: string | null;
}

function getSessionId(ticket: TicketState): string | null {
  const history = [...ticket.phaseHistory].reverse();
  const entry = history.find((e) => e.sessionId);
  return entry?.sessionId ?? null;
}

function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text });
      return true;
    }
    // Linux: try xclip first, then xsel
    try {
      execSync("xclip -selection clipboard", { input: text });
      return true;
    } catch {
      execSync("xsel --clipboard", { input: text });
      return true;
    }
  } catch {
    return false;
  }
}

export function useTicketActions(
  stateManager: StateManager,
  ticket: TicketState | undefined,
): TicketActions {
  const [footerMessage, setFooterMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFooterMessage(msg);
    timerRef.current = setTimeout(() => {
      setFooterMessage(null);
      timerRef.current = null;
    }, 2000);
  }, []);

  const updateStatus = useCallback(
    async (newStatus: TicketStatus) => {
      if (!ticket) return;
      await stateManager.updateTicket(ticket.planId, ticket.ticketId, {
        status: newStatus,
      });
    },
    [stateManager, ticket],
  );

  const pause = useCallback(async () => {
    if (ticket?.status !== "running") return;
    await updateStatus("paused");
  }, [ticket, updateStatus]);

  const resume = useCallback(async () => {
    if (ticket?.status !== "paused") return;
    await updateStatus("ready");
  }, [ticket, updateStatus]);

  const retry = useCallback(async () => {
    if (ticket?.status !== "failed") return;
    await updateStatus("ready");
  }, [ticket, updateStatus]);

  const skip = useCallback(async () => {
    if (ticket?.status !== "failed" && ticket?.status !== "needs_attention")
      return;
    await updateStatus("complete");
  }, [ticket, updateStatus]);

  const copySessionId = useCallback(() => {
    if (!ticket) return;
    const sessionId = getSessionId(ticket);
    if (!sessionId) {
      showMessage("\u2717 No session ID available");
      return;
    }
    if (copyToClipboard(sessionId)) {
      showMessage(`\u2713 Copied ${sessionId}`);
    } else {
      showMessage("\u2717 Clipboard unavailable");
    }
  }, [ticket, showMessage]);

  return { pause, resume, retry, skip, copySessionId, footerMessage };
}

/** Returns hotkeys valid for the given ticket status */
export function getStatusHotkeys(status: TicketStatus | undefined) {
  const hotkeys: Array<{ key: string; label: string }> = [];
  if (status === "running") {
    hotkeys.push({ key: "p", label: "pause" });
  }
  if (status === "paused") {
    hotkeys.push({ key: "R", label: "resume" });
  }
  if (status === "failed") {
    hotkeys.push({ key: "r", label: "retry" });
  }
  if (status === "failed" || status === "needs_attention") {
    hotkeys.push({ key: "s", label: "skip" });
  }
  hotkeys.push({ key: "c", label: "copy session" });
  return hotkeys;
}
