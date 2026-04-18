# JIRA Provider Skill — Design Spec

**Date:** 2026-04-17
**Status:** Draft

---

## Overview

Add a JIRA provider skill that teaches the AI planner how to fetch issues from a JIRA sprint via an MCP server and convert them into orchestrator plan and ticket state files.

The deliverable is a single new file: `skills/providers/jira/SKILL.md`. No source code changes are required — this follows the same pattern as the existing Linear and GitHub Issues providers.

---

## Context

The orchestrator has two existing provider skills:
- **Linear** (`skills/providers/linear/SKILL.md`) — uses MCP tools (`mcp__linear__*`)
- **GitHub Issues** (`skills/providers/github-issues/SKILL.md`) — uses the `gh` CLI

Both skills are reference documents consumed by the AI planner during interactive sessions (`orchestrator interactive`). They teach the planner how to pull work items from an external system and produce the JSON state files the deterministic runner consumes.

---

## Approach

The JIRA MCP server's exact tool names are not known in advance — they vary across implementations. The skill uses a **runtime discovery** approach: the planner first lists available MCP tools, identifies JIRA-related ones, then proceeds. The skill documents the expected tool shapes as a guide, but the planner adapts to what is actually present.

Once the user has confirmed which specific tools work, the skill can be updated to hard-code those tool names and remove the discovery scaffolding.

---

## Scope

**In scope:**
- Fetching all issues from a named JIRA sprint
- Mapping JIRA fields to orchestrator ticket state fields
- Extracting acceptance criteria from issue descriptions
- Resolving `blocks`/`is blocked by` linked issue dependencies
- Generating branch names and worktree paths
- Selecting workflows based on JIRA issue type
- An end-to-end example (Sprint → plan.json + ticket files)

**Out of scope:**
- Sub-tasks: rolled up into parent issues, not created as separate tickets
- Epics as the grouping unit (sprint only for now)
- Writeback to JIRA (status updates, comments)
- Multi-project sprints (single project per plan)

---

## Skill Sections

### 1. MCP Tool Discovery

Instruct the planner to:
1. List all available MCP tools in the current session
2. Filter for tools whose names contain `jira` (case-insensitive)
3. Identify tools covering: search/list issues, get a single issue, list boards, list sprints

Expected tool shapes (may vary by implementation):

| Purpose | Likely tool name pattern |
|---------|--------------------------|
| Search issues (JQL) | `mcp__jira__search_issues` / `mcp__jira__jql` |
| Get single issue | `mcp__jira__get_issue` |
| List boards | `mcp__jira__list_boards` |
| List sprints for a board | `mcp__jira__get_sprints` / `mcp__jira__list_sprints` |

If no sprint listing tool exists, fall back to JQL: `project = <KEY> AND sprint = "<Sprint Name>" AND issuetype != Sub-task`.

### 2. Fetching a Sprint

Steps:
1. Ask the user for the project key and sprint name (or accept them as input)
2. Locate the board for the project
3. Find the sprint by name (or use the active sprint if no name given)
4. Fetch all issues in the sprint, filtering out `issuetype = Sub-task`
5. For each issue, fetch full details (description, linked issues, comments)

### 3. Field Mapping

| JIRA Field | Orchestrator Field | Notes |
|-----------|-------------------|-------|
| `key` | `ticketId` | e.g., `"PROJ-101"` |
| `summary` | `title` | Direct mapping |
| `description` (ADF or markdown) | `description` | Convert ADF to markdown if needed. Expand terse descriptions with context. |
| Issue URL | `linearUrl` | Full JIRA issue URL. The field name is historical — it holds any tracker URL. |
| — | `acceptanceCriteria` | Extracted from description (see below) |
| — | `repo` | Determined from project/team context |
| — | `branch` | Generated: `<username>/<key-lowercase>-<slug>` |
| — | `worktree` | Generated: `<worktreeRoot>/<key>` |

### 4. Acceptance Criteria Extraction

Look for in the description:

1. **Explicit sections**: Headers like `Acceptance Criteria`, `AC`, `Definition of Done`, `Requirements`
2. **Checkbox lists**: `- [ ] criterion` patterns
3. **Numbered lists** under a criteria heading

If none found, derive from the description:
- Each distinct requirement → one criterion
- Each behavioral expectation → one criterion
- Always add `"Existing tests still pass"` as a default criterion

### 5. Dependency Resolution

JIRA supports first-class issue links. Map them:

| JIRA Link Type | Orchestrator Mapping |
|---------------|---------------------|
| `is blocked by` | Add blocking issue key to `blockedBy` |
| `blocks` | Add this key to the blocked issue's `blockedBy` |
| `relates to` / `duplicates` | Informational only — skip |

Only include dependencies for issues within the same sprint/plan. Cross-plan dependencies are noted in the ticket description instead.

### 6. Branch & Worktree Naming

Convention: `<username>/<key-lowercase>-<slug>`

Slug generation:
1. Lowercase the summary
2. Replace spaces and special characters with hyphens
3. Truncate to ~40 characters
4. Remove trailing hyphens

Examples:
- `PROJ-101` "Add password reset endpoint" → `sam/proj-101-add-password-reset-endpoint`
- `PROJ-55` "Fix login redirect loop" → `sam/proj-55-fix-login-redirect-loop`

### 7. Workflow Selection

| JIRA Signal | Workflow |
|------------|----------|
| Issue type: `Bug` | `bugfix` |
| Issue type: `Story`, `Task`, `Epic`, or other | `standard` |
| Label: `hotfix` | `bugfix` |

List the workflow YAML files in the workflow directory to see all available workflows.

---

## End-to-End Example

Given JIRA project `PROJ`, sprint `"Sprint 12"` with:
- PROJ-101 "Add password reset endpoint" (Story, no blockers)
- PROJ-102 "Add password reset UI" (Story, blocked by PROJ-101)
- PROJ-103 "Fix login redirect loop" (Bug, no blockers)

**plan.json:**
```json
{
  "id": "proj-sprint-12",
  "name": "PROJ — Sprint 12",
  "createdAt": "2026-04-17T10:00:00Z",
  "createdBy": "planner",
  "repo": "/Users/sam/repos/proj-backend",
  "workflow": "standard",
  "agent": null,
  "worktreeRoot": "/Users/sam/worktrees",
  "status": "active",
  "tickets": [
    { "ticketId": "PROJ-101", "order": 1, "blockedBy": [] },
    { "ticketId": "PROJ-102", "order": 2, "blockedBy": ["PROJ-101"] },
    { "ticketId": "PROJ-103", "order": 1, "blockedBy": [] }
  ]
}
```

Note: PROJ-103 uses `"workflow": "bugfix"` at the ticket level.

**tickets/PROJ-103.json:**
```json
{
  "planId": "proj-sprint-12",
  "ticketId": "PROJ-103",
  "title": "Fix login redirect loop",
  "description": "After successful login, users are redirected back to /login instead of /dashboard. The redirect URL is read from the query string but not validated — if the callback URL is missing or malformed, the redirect defaults to /login.",
  "acceptanceCriteria": [
    "Successful login redirects to /dashboard by default",
    "If a valid returnTo query param is present, redirect there instead",
    "Invalid or missing returnTo falls back to /dashboard",
    "Existing tests still pass"
  ],
  "linearUrl": "https://yourcompany.atlassian.net/browse/PROJ-103",
  "repo": "/Users/sam/repos/proj-backend",
  "workflow": "bugfix",
  "branch": "sam/proj-103-fix-login-redirect-loop",
  "worktree": "/Users/sam/worktrees/PROJ-103",
  "agent": null,
  "status": "queued",
  "currentPhase": "setup",
  "phaseHistory": [],
  "context": {},
  "retries": {},
  "error": null
}
```

---

## Checklist

The planner should verify before finalizing:

1. All sprint issues (excluding Sub-tasks) are accounted for.
2. Ticket IDs use the JIRA key format (`PROJ-101`), matching the file name.
3. Dependencies from JIRA issue links are correctly mapped to `blockedBy`.
4. Acceptance criteria are extracted or derived for every ticket.
5. Bug issues use the `bugfix` workflow (override at ticket level if needed).
6. Branch names are unique and follow the naming convention.
7. The `linearUrl` field contains the full JIRA issue URL.
8. The `repo` path is correct for this project.
9. Run `orchestrator status --plan <plan-id>` to confirm the plan and tickets are valid.

---

## Update Path

Once specific MCP tool names are confirmed to work:
1. Replace the discovery section with concrete tool names and usage examples
2. Remove the "expected tool shapes" table
3. Optionally add a "Known Working MCP Servers" note for future reference
