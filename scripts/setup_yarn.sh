#!/bin/bash
set -e

NPM_GLOBAL_DIR="${CI_PROJECT_DIR}/.npm-global"
echo "Setting up NPM global directory at $NPM_GLOBAL_DIR"

# Only remove if it exists and is not empty
if [ -d "$NPM_GLOBAL_DIR" ] && [ "$(ls -A "$NPM_GLOBAL_DIR")" ]; then
  echo "Directory exists and is not empty. Skipping removal."
else
  echo "Directory does not exist or is empty. Creating it..."
  mkdir -p "$NPM_GLOBAL_DIR/bin"
fi


npm config set prefix "$NPM_GLOBAL_DIR"
export PATH="$NPM_GLOBAL_DIR/bin:$PATH"

# Check if yarn is already installed
if command -v yarn >/dev/null 2>&1; then
  echo "Yarn is already installed. Skipping installation."
else
  echo "Yarn not found. Installing..."
  npm install -g yarn
fi

# Remove node_modules and yarn.lock for a clean install
rm -rf node_modules yarn.lock || true

# Clean Yarn and npm caches to avoid corrupt package issues
# Clean global Yarn cache
yarn cache clean || true
rm -rf ~/.cache/yarn || true
# Clean local Yarn and npm caches if present
rm -rf .yarn/cache || true
rm -rf node_modules/.cache || true
npm cache clean --force || true

# Print versions
node -v && npm -v && yarn -v

# Ensure node_modules/.bin is in PATH for local binaries like webpack
export PATH="$(pwd)/node_modules/.bin:$PATH"