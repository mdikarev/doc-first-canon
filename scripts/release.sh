#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY=0
if [[ "${1:-}" == "--dry-run" || "${DRY_RUN:-}" == "1" ]]; then
  DRY=1
fi

npm test
npm run build
node bin/doc-canon.js validate --root "$ROOT"

PACK_OUT="$(npm pack --dry-run 2>&1)"
echo "$PACK_OUT"
for required in LICENSE CHANGELOG.md README.md; do
  echo "$PACK_OUT" | grep -q "$required" || {
    echo "error: npm pack listing missing $required" >&2
    exit 1
  }
done

if [[ "$DRY" -eq 1 ]]; then
  echo "dry-run: skip npm publish"
  exit 0
fi

npm publish
