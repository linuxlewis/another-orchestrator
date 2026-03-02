#!/usr/bin/env bash
set -euo pipefail

REPO_PATH="$1"
PR_NUMBER="$2"

cd "$REPO_PATH"

# Get the formal review decision
review_decision=$(gh pr view "$PR_NUMBER" --json reviewDecision --jq '.reviewDecision' 2>/dev/null) || {
  echo "Error fetching PR review status" >&2
  exit 2
}

# Check for unresolved review thread comments
unresolved_threads=$(gh api "repos/{owner}/{repo}/pulls/${PR_NUMBER}/reviews" \
  --jq '[.[] | select(.state == "CHANGES_REQUESTED" or .state == "COMMENTED")] | length' 2>/dev/null) || unresolved_threads="0"

# Also check for unresolved review comments via review threads
unresolved_comments=$(gh api graphql -f query='
  query($number: Int!) {
    repository(owner: "{owner}", name: "{repo}") {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            isResolved
          }
        }
      }
    }
  }
' -F number="$PR_NUMBER" --jq '.data.repository.pullRequest.reviewThreads.nodes | map(select(.isResolved == false)) | length' 2>/dev/null) || unresolved_comments="0"

# APPROVED with no unresolved comments
if [ "$review_decision" = "APPROVED" ] && [ "$unresolved_comments" = "0" -o "$unresolved_comments" = "" ]; then
  echo "approved"
  exit 0
fi

# CHANGES_REQUESTED is actionable — exit 2 so the poll phase treats it as failure
if [ "$review_decision" = "CHANGES_REQUESTED" ]; then
  echo "changes_requested"
  exit 2
fi

# Unresolved review comments trigger review handling even without formal decision
if [ "$unresolved_comments" != "0" ] && [ "$unresolved_comments" != "" ]; then
  echo "changes_requested"
  exit 2
fi

# No reviews yet or only REVIEW_REQUIRED — still waiting
exit 1
