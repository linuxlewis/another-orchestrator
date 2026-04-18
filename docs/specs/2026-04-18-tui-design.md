# TUI Design Spec

**Date:** 2026-04-18  
**Command:** `orchestrator tui`

## Overview

A K9s-style terminal UI for monitoring active plans and tickets and taking light management actions (pause, resume, retry, skip). Built with Ink (React for CLIs). Opens via `orchestrator tui`.

**Visual reference:** Open [`tui-mockups/screens-detail.html`](tui-mockups/screens-detail.html) in a browser to see the target look for all three screens.

## Navigation Model

Three-level hierarchy with breadcrumb navigation:

```
Plans  ›  <plan-name>  ›  <ticket-id>  ›  log
```

- `↑↓` — move selection within current screen
- `Enter` — drill into selected item (push screen)
- `Escape` — go back up (pop screen)
- `/` — filter current table by name/status

State is a navigation stack: `[{screen: 'plans'}, {screen: 'tickets', planId}, {screen: 'log', planId, ticketId}]`

## Screen 1 — Plans

Default view on open. Shows all plans from `StateManager.listPlans()`.

**Columns:** NAME · STATUS · PROGRESS · RUNNING · FAILED · AGE

- **PROGRESS** — `completed/total` tickets with an 8-char block bar (e.g. `3/8 [███░░░░░]`)
- **RUNNING** — count of running tickets, green when > 0
- **FAILED** — count of failed tickets, red when > 0
- **AGE** — time since `plan.createdAt`

**Hotkeys:**

| Key | Action |
|-----|--------|
| `↑↓` | navigate |
| `Enter` | open tickets for selected plan |
| `/` | filter by name |
| `q` | quit |

## Screen 2 — Tickets

Ticket list for the selected plan. Shows all tickets from `StateManager.listTickets(planId)`.

**Columns:** TICKET · STATUS · PHASE · RETRY · BLOCK · AGE

- **PHASE** — `<type> <index>/<total>`, type color-coded: agent=purple, script=green, poll=pink, terminal=yellow
- **RETRY** — retry count from `ticket.retries`, yellow when > 0
- **BLOCK** — ticket ID this ticket is waiting on (`blockedBy`), or `—`
- **AGE** — time since ticket entered current status

**Hotkeys are context-sensitive** — only shown/active for valid actions on the selected ticket:

| Key | Action | Available when |
|-----|--------|----------------|
| `↑↓` | navigate | always |
| `Enter` | open session log | always |
| `p` | pause ticket | running |
| `R` (resume) | resume ticket | paused |
| `r` | retry ticket | failed |
| `s` | skip ticket | failed, needs_attention |
| `c` | copy session ID | any `phaseHistory` entry has a `sessionId` |
| `/` | filter | always |
| `Esc` | back to plans | always |

## Screen 3 — Session Log

Full-screen log stream for the selected ticket. Reads `~/.orchestrator/logs/<ticketId>.log`.

**Header:** ticket ID · phase name · phase index/total · elapsed time  
**Status indicator:** `● tailing` (auto-following) or `● scrolling` (user scrolled up)

**Behaviour:**
- On open: reads existing log file content in full, then watches for new lines via `fs.watch` + `readline`
- Auto-tails by default (newest line always visible)
- Scrolling up with `↑` pauses auto-tail and switches indicator to `● scrolling`
- `G` snaps to bottom and resumes auto-tail

**Hotkeys:**

| Key | Action |
|-----|--------|
| `↑↓` | scroll |
| `G` | jump to bottom, resume tail |
| `p` | pause ticket |
| `R` | resume ticket |
| `r` | retry ticket |
| `c` | copy session ID to clipboard |
| `Esc` | back to tickets |

**Copy session ID (`c`):** Runs `pbcopy` on macOS, `xclip -selection clipboard` or `xsel --clipboard` on Linux (falls back gracefully with a `✗ clipboard unavailable` message if neither is found). Shows `✓ Copied <sessionId>` in the footer for 2 seconds, then reverts to normal hotkey display. Session ID sourced from the most recent `PhaseHistoryEntry` in `ticket.phaseHistory` that has a `sessionId` field set.

## Layout Structure

```
┌─ header ──────────────────────────────────────────────────────┐
│ orchestrator          breadcrumb · context info          ● live│
├─ breadcrumb ──────────────────────────────────────────────────┤
│ Plans › feature-auth › AUTH-001 › log                         │
├─ content ─────────────────────────────────────────────────────┤
│                                                               │
│  (table or log stream fills this area)                        │
│                                                               │
├─ footer ──────────────────────────────────────────────────────┤
│ ↑↓ navigate   ⏎ open   p pause   r retry   / filter   q quit │
└───────────────────────────────────────────────────────────────┘
```

Terminal height is respected — table rows are capped to available lines. Log screen uses remaining height after header/footer.

## Live Updates

State refreshes via **chokidar** watching the `stateDir` (resolved from config). On any file change event, the affected plan or ticket JSON is re-read through `StateManager` and React state is updated, triggering a re-render.

Refresh is debounced at 150ms to coalesce rapid writes (e.g. a ticket update + plan update in quick succession).

Log tailing uses `fs.createReadStream` for initial content and `fs.watch` for new appended lines, parsed via Node's `readline` interface. No polling.

## Component Structure

```
src/tui/
  app.tsx                   # Root: navigation stack, chokidar subscription, global keys
  components/
    Header.tsx              # Top bar: app name, context info, live indicator
    Breadcrumb.tsx          # Breadcrumb row beneath header
    Footer.tsx              # Hotkey bar, driven by current screen + selected item state
    Table.tsx               # Reusable keyboard-navigable table (columns, rows, selection)
    StatusBadge.tsx         # Color-coded status pill (running/paused/failed/etc.)
  screens/
    PlansScreen.tsx         # Plans table
    TicketsScreen.tsx       # Tickets table
    LogScreen.tsx           # Log stream + tail management
src/commands/tui.ts         # CLI command registration, boots Ink app
```

## Dependencies

New runtime dependencies:
- `ink` — React-based TUI framework
- `react` — peer dep of Ink

New dev dependencies:
- `@types/react`

`chokidar` and `fs`/`readline` are already available.

## Out of Scope

- Starting new plans or tickets from the TUI
- Editing plan/ticket configuration
- Resuming a Claude session from within the TUI (session ID is copied to clipboard; user runs `claude resume <id>` manually)
- Multi-select actions
