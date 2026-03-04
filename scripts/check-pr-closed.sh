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
  CLOSED)
    echo "closed"
    exit 0
    ;;
  *)
    echo "$state"
    exit 1
    ;;
esac
