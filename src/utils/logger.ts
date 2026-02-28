import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";

export interface Logger {
  info(message: string, ticketId?: string): void;
  warn(message: string, ticketId?: string): void;
  error(message: string, ticketId?: string): void;
  success(message: string, ticketId?: string): void;
  phaseStart(phase: string, ticketId: string): void;
  phaseEnd(phase: string, ticketId: string, status: string): void;
  agentOutput(ticketId: string, output: string): void;
}

function timestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function writeToFile(logDir: string, ticketId: string, line: string) {
  await mkdir(logDir, { recursive: true });
  const filePath = join(logDir, `${ticketId}.log`);
  await appendFile(filePath, `${line}\n`);
}

function fileTimestamp(): string {
  return new Date().toISOString();
}

export function createLogger(logDir: string): Logger {
  function consoleLog(
    level: string,
    colorFn: (s: string) => string,
    message: string,
    ticketId?: string,
  ) {
    const tag = ticketId ? ` [${ticketId}]` : "";
    console.log(`[${timestamp()}] [${colorFn(level)}]${tag} ${message}`);
  }

  function fileLog(level: string, ticketId: string, message: string) {
    const line = `[${fileTimestamp()}] [${level}] ${message}`;
    writeToFile(logDir, ticketId, line).catch(() => {});
  }

  return {
    info(message, ticketId) {
      consoleLog("INFO", chalk.blue, message, ticketId);
      if (ticketId) fileLog("INFO", ticketId, message);
    },

    warn(message, ticketId) {
      consoleLog("WARN", chalk.yellow, message, ticketId);
      if (ticketId) fileLog("WARN", ticketId, message);
    },

    error(message, ticketId) {
      consoleLog("ERROR", chalk.red, message, ticketId);
      if (ticketId) fileLog("ERROR", ticketId, message);
    },

    success(message, ticketId) {
      consoleLog("SUCCESS", chalk.green, message, ticketId);
      if (ticketId) fileLog("SUCCESS", ticketId, message);
    },

    phaseStart(phase, ticketId) {
      const msg = `Phase "${phase}" started`;
      consoleLog("INFO", chalk.blue, msg, ticketId);
      fileLog("INFO", ticketId, msg);
    },

    phaseEnd(phase, ticketId, status) {
      const msg = `Phase "${phase}" ended with status: ${status}`;
      const colorFn = status === "success" ? chalk.green : chalk.red;
      consoleLog(
        status === "success" ? "SUCCESS" : "ERROR",
        colorFn,
        msg,
        ticketId,
      );
      fileLog(status === "success" ? "SUCCESS" : "ERROR", ticketId, msg);
    },

    agentOutput(ticketId, output) {
      fileLog("AGENT", ticketId, output);
    },
  };
}
