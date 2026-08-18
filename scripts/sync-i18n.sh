#!/usr/bin/env bash
# Sync the desktop i18n dictionaries with the upstream Papex web strings.
#
# Strategy (dev plan §8): take `papex/src/i18n` as the source of truth for shared
# keys, merge with the desktop-only namespaces (reader/annotations/citations/
# stats/upload) kept under `src/lib/i18n`, and emit `en.json` + `zh.json`.
#
# This is a placeholder that documents the contract; the real merge runs in CI
# against a checked-out papex repo via PAPEX_REPO env var.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAPEX_REPO="${PAPEX_REPO:-../papex}"
DESKTOP_I18N="$ROOT/src/lib/i18n"

echo "Merging i18n from $PAPEX_REPO/src/i18n into $DESKTOP_I18N"
if [ -d "$PAPEX_REPO/src/i18n" ]; then
  echo "Found upstream i18n directory; merge shared keys here (manual review required)."
else
  echo "Upstream papex repo not found at $PAPEX_REPO; skipping auto-merge."
  echo "Desktop-only namespaces remain authoritative in $DESKTOP_I18N."
fi
