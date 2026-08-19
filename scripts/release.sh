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

# Always tag the released commit (lightweight v<version>) — a successful release
# must carry its tag. Dry-run exits before publish, so dry-runs never tag.
VERSION="$(node -p "require('./package.json').version")"
if ! git rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null 2>&1; then
  git tag "v$VERSION"
fi
git push origin "v$VERSION" || echo "warning: tag v$VERSION created locally; push to origin failed"
