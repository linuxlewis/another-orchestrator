#!/usr/bin/env bash
set -euo pipefail

review_state="$(printf '%s' "${1:-}" | tr -d '[:space:]')"

case "$review_state" in
  approved|merged)
    exit 0
    ;;
  changes_requested|commented|ci_failed)
    exit 1
    ;;
  *)
    echo "Unknown review state: $review_state" >&2
    exit 2
    ;;
esac
