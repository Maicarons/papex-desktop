#!/usr/bin/env bash
# Generate TypeScript API types from the Papex server OpenAPI document.
#
# The schema lives in the `papex` repo (or a published URL). This script fetches
# `openapi.json` and runs `openapi-typescript`, overwriting
# `src/lib/api/generated.ts`. The committed baseline in that file mirrors the
# documented contract so the app compiles before this runs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/src/lib/api/generated.ts"

# Source of the OpenAPI document. Override with OPENAPI_URL env var.
OPENAPI_URL="${OPENAPI_URL:-https://api.papex.example.com/openapi.json}"

echo "Fetching OpenAPI schema from $OPENAPI_URL"
curl -fsSL "$OPENAPI_URL" -o "$ROOT/openapi.json"

echo "Generating types -> $OUT"
pnpm exec openapi-typescript "$ROOT/openapi.json" \
  --output "$OUT" \
  --alphabetize \
  --export-type

echo "Done. Types written to $OUT"
