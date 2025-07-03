#!/bin/bash
set -e
set -x  # Print commands as they run for easier debugging

NPM_GLOBAL_DIR="${CI_PROJECT_DIR}/.npm-global"
echo "Setting up NPM global directory at $NPM_GLOBAL_DIR"

# Ensure the global npm directory exists
if [ -d "$NPM_GLOBAL_DIR" ] && [ "$(ls -A "$NPM_GLOBAL_DIR")" ]; then
  echo "Directory exists and is not empty. Skipping creation."
else
  echo "Directory does not exist or is empty. Creating it..."
  mkdir -p "$NPM_GLOBAL_DIR/bin"
fi

# Configure npm to use the custom global directory
npm config set prefix "$NPM_GLOBAL_DIR"
export PATH="$NPM_GLOBAL_DIR/bin:$PATH"

# Install yarn if not already installed
if command -v yarn >/dev/null 2>&1; then
  echo "Yarn is already installed. Skipping installation."
else
  echo "Yarn not found. Installing..."
  npm install -g yarn
fi

# Clean up caches and corrupted packages
echo "Cleaning up caches and corrupted packages..."
rm -rf node_modules yarn.lock || true
yarn cache clean --all || true
rm -rf ~/.cache/yarn || true
rm -rf .yarn/cache || true
rm -rf node_modules/.cache || true
rm -rf "${CI_PROJECT_DIR}/.cache/yarn/v6/npm-color-convert-"* || true
npm cache clean --force || true

# Print versions for debugging
node -v && npm -v && yarn -v

# Add local node_modules binaries to PATH
export PATH="$(pwd)/node_modules/.bin:$PATH"

# Retry yarn install up to 3 times in case of transient errors
n=0
until [ $n -ge 3 ]; do
  yarn install --frozen-lockfile && break
  n=$((n+1))
  echo "Retrying yarn install ($n)..."
  sleep 5
done
