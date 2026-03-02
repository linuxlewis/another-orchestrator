#!/usr/bin/env bash
set -euo pipefail

REPO_PATH="$1"
PR_NUMBER="$2"

cd "$REPO_PATH"

state=$(gh pr view "$PR_NUMBER" --json state --jq '.state' 2>/dev/null) || {
  echo "Error fetching PR state" >&2
  exit 2
}

case "$state" in
  MERGED)
    echo "merged"
    exit 0
    ;;
  CLOSED)
    echo "closed"
    exit 2
    ;;
  *)
    # Still open, waiting
    exit 1
    ;;
esac
