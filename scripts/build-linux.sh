#!/usr/bin/env bash
# Build Linux bundles (.deb / AppImage / .rpm).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
pnpm install --frozen-lockfile
pnpm tauri build --target x86_64-unknown-linux-gnu
echo "Linux artifacts in src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/"
