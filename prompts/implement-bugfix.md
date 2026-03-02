# Bug Fix Task

## Ticket: {{ ticketId }}

**{{ title }}**

{{ description }}

{% if acceptance_criteria_list %}
## Acceptance Criteria

{{ acceptance_criteria_list }}
{% endif %}

## Working Directory

You are working in: `{{ worktree }}`
Branch: `{{ branch }}`
Repository: `{{ repo }}`

{% if linearUrl %}
Linear issue: {{ linearUrl }}
{% endif %}

## Instructions

1. Read and understand the bug report above.
2. Explore the codebase to locate the root cause of the bug.
3. Identify the root cause before making any changes — document your findings.
4. Make the minimal change necessary to fix the bug. Avoid unrelated refactoring.
5. Write a regression test that reproduces the original bug and verifies the fix.
6. Run the project's test suite and ensure all tests pass.
7. Run any available linters and fix issues before finishing.
8. Do not commit your changes — the orchestrator will handle that.
