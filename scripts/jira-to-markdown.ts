#!/usr/bin/env tsx
/**
 * Thin CLI wrapper around `orchestrator import`.
 * Usage: tsx scripts/jira-to-markdown.ts <path-to-export.xml> [--out <dir>]
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { convertJiraXml } from "../src/commands/import.js";

const xmlPath = process.argv[2];
const outFlag = process.argv.indexOf("--out");
const outputDir =
  outFlag !== -1 && process.argv[outFlag + 1]
    ? process.argv[outFlag + 1]
    : join(homedir(), ".orchestrator", "issues");

if (!xmlPath) {
  console.error("Usage: tsx scripts/jira-to-markdown.ts <path-to-export.xml> [--out <dir>]");
  process.exit(1);
}

const written = convertJiraXml(xmlPath, outputDir);
for (const path of written) {
  console.log(`Written: ${path}`);
}
