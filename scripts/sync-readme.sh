#!/usr/bin/env bash
# Sync the bilingual README from the source docs in the papex repo.
#
# Source: papex/docs/projects/papex-desktop/README.md (+ README_zh.md).
# Destination: repo root README.md / README_zh.md (already authored; this script
# only refreshes them when the source changes and is run by maintainers).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${PAPEX_DOCS:-../papex/docs/projects/papex-desktop}"

for f in README.md README_zh.md; do
  if [ -f "$SRC/$f" ]; then
    cp "$SRC/$f" "$ROOT/$f"
    echo "Updated $ROOT/$f"
  else
    echo "Source $SRC/$f not found; leaving $ROOT/$f untouched."
  fi
done
