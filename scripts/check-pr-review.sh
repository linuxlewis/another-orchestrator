#!/usr/bin/env bash
set -euo pipefail

REPO_PATH="$1"
PR_NUMBER="$2"

cd "$REPO_PATH"

# Resolve owner/repo for GraphQL queries
REPO_NWO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null) || {
  echo "Error resolving repository" >&2
  exit 2
}
OWNER="${REPO_NWO%%/*}"
REPO="${REPO_NWO##*/}"

# Get the formal review decision
review_decision=$(gh pr view "$PR_NUMBER" --json reviewDecision --jq '.reviewDecision' 2>/dev/null) || {
  echo "Error fetching PR review status" >&2
  exit 2
}

# Check for unresolved review threads via GraphQL
# (uses temp file to avoid bash ! interpretation issues in query string)
_gql_tmp=$(mktemp)
trap 'rm -f "$_gql_tmp"' EXIT
cat > "$_gql_tmp" << 'GRAPHQL'
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          isResolved
        }
      }
    }
  }
}
GRAPHQL
unresolved_comments=$(gh api graphql \
  -F owner="$OWNER" \
  -F repo="$REPO" \
  -F number="$PR_NUMBER" \
  -F "query=@$_gql_tmp" \
  --jq '.data.repository.pullRequest.reviewThreads.nodes | map(select(.isResolved == false)) | length' 2>/dev/null) || unresolved_comments="0"

# Check CI status
ci_failed=$(gh pr checks "$PR_NUMBER" --json bucket \
  --jq '[.[] | select(.bucket == "fail")] | length' 2>/dev/null) || ci_failed="0"

# APPROVED takes priority — unresolved comments don't block an approval
if [ "$review_decision" = "APPROVED" ]; then
  echo "approved"
  exit 0
fi

# CHANGES_REQUESTED is actionable — exit 2 so the poll phase treats it as failure
if [ "$review_decision" = "CHANGES_REQUESTED" ]; then
  echo "changes_requested"
  exit 2
fi

# CI failures are actionable
if [ "$ci_failed" != "0" ] && [ "$ci_failed" != "" ]; then
  echo "ci_failed"
  exit 2
fi

# Unresolved review comments trigger review handling (only when not approved)
if [ "$unresolved_comments" != "0" ] && [ "$unresolved_comments" != "" ]; then
  echo "changes_requested"
  exit 2
fi

# No reviews yet or only REVIEW_REQUIRED — still waiting
exit 1
