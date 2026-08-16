#!/usr/bin/env sh
set -eu

cd /wiki

# Avoid duplicate dev servers when this script is called manually.
if pgrep -f "node dev" >/dev/null 2>&1; then
  echo "Wiki dev server already running. Skipping duplicate start."
  exit 0
fi

# First run in a fresh node_modules volume may need dependencies.
if [ ! -x node_modules/.bin/cross-env ]; then
  echo "Installing dependencies (first run)..."
  npm install --legacy-peer-deps
fi

echo "Starting Wiki.js dev server..."
exec npm run dev
