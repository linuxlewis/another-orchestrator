# Create Pull Request

## Ticket: {{ ticketId }}

**{{ title }}**

{{ description }}

## Working Directory

You are working in: `{{ worktree }}`
Branch: `{{ branch }}`
Repository: `{{ repo }}`

{% if linearUrl %}
Linear issue: {{ linearUrl }}
{% endif %}

## Instructions

1. Stage all changes and create a commit with a clear, descriptive message referencing the ticket.
2. Push the branch to the remote repository.
3. Create a pull request using `gh pr create`:
   - Title should reference the ticket ID and summarize the change.
   - Body should describe what was changed and why.
   - Link the Linear issue if available.
4. After creating the PR, output the following on separate lines:
   - `PR_URL=<the full PR URL>`
   - `PR_NUMBER=<the PR number>`

These values will be captured by the orchestrator for subsequent phases.
