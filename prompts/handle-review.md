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

1. Read the review comments on the pull request:
   - `gh pr view {{ context.pr_number }} --comments`
   - `gh api repos/{owner}/{repo}/pulls/{{ context.pr_number }}/reviews`
   - `gh api repos/{owner}/{repo}/pulls/{{ context.pr_number }}/comments` (inline review comments)
2. For each review comment or requested change:
   - Understand what the reviewer is asking for.
   - Make the necessary code changes to address the feedback.
3. After addressing each inline review comment, resolve the conversation thread using the GraphQL API:
   ```bash
   gh api graphql -f query='mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { isResolved } } }' -F id="<THREAD_NODE_ID>"
   ```
   To get thread node IDs, query:
   ```bash
   gh api graphql -f query='query($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { pullRequest(number: $number) { reviewThreads(first: 100) { nodes { id isResolved comments(first: 1) { nodes { body } } } } } } }' -F owner="{owner}" -F repo="{repo}" -F number={{ context.pr_number }}
   ```
4. Run the linter, type checker, and test suite to ensure everything still passes.
5. Do not commit or push your changes — the orchestrator will handle that in a subsequent phase.
