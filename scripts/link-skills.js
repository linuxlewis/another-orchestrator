#!/usr/bin/env node

// Creates .claude/skills/ symlinks pointing to each skill directory under skills/.
// This lets Claude Code auto-discover skills when the skills dir is passed via --add-dir.

import { readdir, mkdir, symlink, rm, lstat } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(import.meta.url), "../..");
const skillsSrc = join(rootDir, "skills");
const targetDir = join(skillsSrc, ".claude", "skills");

await rm(targetDir, { recursive: true, force: true });
await mkdir(targetDir, { recursive: true });

async function linkSkills(srcDir, prefix = "") {
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ".claude") continue;
    const fullPath = join(srcDir, entry.name);
    const skillName = prefix ? `${prefix}-${entry.name}` : entry.name;

    // Check if this directory has a SKILL.md (it's a leaf skill)
    const children = await readdir(fullPath);
    if (children.includes("SKILL.md")) {
      const linkPath = join(targetDir, skillName);
      const relTarget = relative(targetDir, fullPath);
      await symlink(relTarget, linkPath);
      console.log(`  linked: ${skillName} -> ${relTarget}`);
    }

    // Recurse into subdirectories (e.g., providers/linear/)
    await linkSkills(fullPath, skillName);
  }
}

console.log("Linking skills into skills/.claude/skills/");
await linkSkills(skillsSrc);
console.log("Done.");
