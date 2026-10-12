#!/bin/sh
set -eu
mit_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$mit_root"
if command -v npm >/dev/null 2>&1; then exec npm "$@"; fi
mit_npm="$mit_root/.tools/npm/node_modules/npm/bin/npm-cli.js"
if [ ! -f "$mit_npm" ]; then
  mkdir -p "$mit_root/.tools/npm"
  pnpm --dir "$mit_root/.tools/npm" --store-dir "$mit_root/.tools/store" add npm@11
fi
exec node "$mit_npm" "$@"
