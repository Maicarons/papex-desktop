#!/usr/bin/env bash
# Build + sign the Windows installer (NSIS/MSI).
# Requires a code-signing certificate (OV/EV) set via env before release (M3).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
pnpm install --frozen-lockfile
pnpm tauri build --target x86_64-pc-windows-msvc
echo "Windows artifacts in src-tauri/target/x86_64-pc-windows-msvc/release/bundle/"
