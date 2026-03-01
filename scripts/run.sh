#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-}"
WORKTREE="${2:-}"

echo "=== run.sh ==="
echo "Branch:   $BRANCH"
echo "Worktree: $WORKTREE"
echo "=== done ==="
