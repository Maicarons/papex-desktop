#!/usr/bin/env bash
# Build + notarize the macOS .dmg (Developer ID + notarization).
# Requires APPLE_SIGN_IDENTITY and NOTARY credentials for release (M3).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
pnpm install --frozen-lockfile
pnpm tauri build --target x86_64-apple-darwin
pnpm tauri build --target aarch64-apple-darwin
echo "macOS artifacts in src-tauri/target/*-apple-darwin/release/bundle/"
