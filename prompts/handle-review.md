# Handle Review Comments

## Ticket: {{ ticketId }}

**{{ title }}**

## Working Directory

You are working in: `{{ worktree }}`
Branch: `{{ branch }}`
Repository: `{{ repo }}`

## Pull Request

PR URL: {{ context.pr_url }}
PR Number: {{ context.pr_number }}

## Instructions

1. Read the review comments on the pull request using `gh pr view {{ context.pr_number }} --comments` and `gh api repos/{owner}/{repo}/pulls/{{ context.pr_number }}/reviews`.
2. For each review comment or requested change:
   - Understand what the reviewer is asking for.
   - Make the necessary code changes to address the feedback.
3. Run the linter, type checker, and test suite to ensure everything still passes.
4. Do not commit or push your changes — the orchestrator will handle that in a subsequent phase.
