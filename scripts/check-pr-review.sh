#!/usr/bin/env bash
set -euo pipefail

REPO_PATH="$1"
PR_NUMBER="$2"

cd "$REPO_PATH"

# Check if PR is already merged or closed — don't wait for reviews on a finished PR
pr_state=$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null) || {
  echo "Error fetching PR state" >&2
  exit 2
}
case "$pr_state" in
  MERGED)
    echo "merged"
    exit 0
    ;;
  CLOSED)
    echo "closed"
    exit 2
    ;;
esac

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

# Check for unresolved review threads and actionable PR conversation comments.
# A regular PR comment is actionable when it comes from someone other than the
# PR author and is newer than the PR author's last PR activity. If the author
# has not commented, reviewed, or pushed follow-up commits yet, the baseline is
# the PR creation time.
_gql_tmp=$(mktemp)
_gql_response_tmp=$(mktemp)
trap 'rm -f "$_gql_tmp" "$_gql_response_tmp"' EXIT
cat > "$_gql_tmp" << 'GRAPHQL'
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      createdAt
      author {
        login
      }
      comments(first: 100) {
        nodes {
          author {
            login
          }
          createdAt
          isMinimized
        }
      }
      reviews(first: 100) {
        nodes {
          author {
            login
          }
          submittedAt
        }
      }
      commits(last: 100) {
        nodes {
          commit {
            authoredDate
            committedDate
            authors(first: 10) {
              nodes {
                user {
                  login
                }
              }
            }
          }
        }
      }
      reviewThreads(first: 100) {
        nodes {
          isResolved
        }
      }
    }
  }
}
GRAPHQL
gh api graphql \
  -F owner="$OWNER" \
  -F repo="$REPO" \
  -F number="$PR_NUMBER" \
  -F "query=@$_gql_tmp" \
  > "$_gql_response_tmp" 2>/dev/null || {
  echo "Error fetching PR review details" >&2
  exit 2
}

analysis_output=$(node - "$_gql_response_tmp" <<'NODE'
const fs = require("node:fs");

const responsePath = process.argv[2];
const response = JSON.parse(fs.readFileSync(responsePath, "utf8"));
const pr = response.data?.repository?.pullRequest;

if (!pr) {
  console.error("Missing pull request data");
  process.exit(1);
}

const parseDate = (value) => {
  if (!value) {
    return Number.NaN;
  }
  return Date.parse(value);
};

const comments = pr.comments?.nodes ?? [];
const reviews = pr.reviews?.nodes ?? [];
const commits = pr.commits?.nodes ?? [];
const prAuthor = pr.author?.login ?? "";
const baselineCandidates = [parseDate(pr.createdAt)];

for (const comment of comments) {
  if ((comment?.author?.login ?? "") === prAuthor) {
    baselineCandidates.push(parseDate(comment.createdAt));
  }
}

for (const review of reviews) {
  if ((review?.author?.login ?? "") === prAuthor) {
    baselineCandidates.push(parseDate(review.submittedAt));
  }
}

for (const commitNode of commits) {
  const commit = commitNode?.commit;
  const authoredByPrAuthor = (commit?.authors?.nodes ?? []).some(
    (authorNode) => authorNode?.user?.login === prAuthor,
  );
  if (!authoredByPrAuthor) {
    continue;
  }

  baselineCandidates.push(parseDate(commit.authoredDate));
  baselineCandidates.push(parseDate(commit.committedDate));
}

const baselineTimestamp = baselineCandidates
  .filter((timestamp) => Number.isFinite(timestamp))
  .reduce((latest, timestamp) => Math.max(latest, timestamp), 0);

const actionablePrComments = comments.some((comment) => {
  const authorLogin = comment?.author?.login ?? "";
  if (!authorLogin || authorLogin === prAuthor) {
    return false;
  }
  if (authorLogin.endsWith("[bot]")) {
    return false;
  }
  if (comment?.isMinimized) {
    return false;
  }

  const createdAt = parseDate(comment.createdAt);
  return Number.isFinite(createdAt) && createdAt > baselineTimestamp;
});

const unresolvedComments = (pr.reviewThreads?.nodes ?? []).filter(
  (thread) => thread?.isResolved === false,
).length;

process.stdout.write(`UNRESOLVED_COMMENTS=${unresolvedComments}\n`);
process.stdout.write(
  `ACTIONABLE_PR_COMMENTS=${actionablePrComments ? "1" : "0"}\n`,
);
NODE
) || {
  echo "Error analyzing PR review details" >&2
  exit 2
}

unresolved_comments="0"
actionable_pr_comments="0"
while IFS='=' read -r key value; do
  case "$key" in
    UNRESOLVED_COMMENTS) unresolved_comments="$value" ;;
    ACTIONABLE_PR_COMMENTS) actionable_pr_comments="$value" ;;
  esac
done <<< "$analysis_output"

# Check CI status
ci_failed=$(gh pr checks "$PR_NUMBER" --json bucket \
  --jq '[.[] | select(.bucket == "fail")] | length' 2>/dev/null) || ci_failed="0"

# CHANGES_REQUESTED is actionable
if [ "$review_decision" = "CHANGES_REQUESTED" ] || {
  [ "$unresolved_comments" != "0" ] && [ "$unresolved_comments" != "" ]
}; then
  echo "changes_requested"
  exit 0
fi

if [ "$actionable_pr_comments" != "0" ] && [ "$actionable_pr_comments" != "" ]; then
  echo "commented"
  exit 0
fi

if [ "$ci_failed" != "0" ] && [ "$ci_failed" != "" ]; then
  echo "ci_failed"
  exit 0
fi

if [ "$review_decision" = "APPROVED" ]; then
  echo "approved"
  exit 0
fi

# No reviews yet or only REVIEW_REQUIRED — still waiting
exit 1
