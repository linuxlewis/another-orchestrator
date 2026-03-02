# Simplify Task

## Ticket: {{ ticketId }}

**{{ title }}**

## Working Directory

You are working in: `{{ worktree }}`
Branch: `{{ branch }}`
Repository: `{{ repo }}`

## Instructions

Review and simplify the code changes on this branch. Focus on:

1. Remove dead code — unused imports, variables, functions, and commented-out blocks.
2. Inline single-use abstractions — if a helper is only called once, inline it.
3. Simplify overly complex logic — flatten nested conditions, reduce indirection.
4. Remove unnecessary type assertions or casts where TypeScript can infer types.
5. Consolidate duplicate code within the changed files.

**Important constraints:**
- Do not change any observable behavior. All tests must continue to pass.
- Only simplify code that was added or modified by this branch.
- Do not touch unrelated files or pre-existing code.
- Run the test suite after making changes to verify nothing broke.
- Do not commit your changes — the orchestrator will handle that.
