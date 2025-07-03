#!/bin/bash
set -e
set -x  # Optional: print commands as they run for easier debugging

NPM_GLOBAL_DIR="${CI_PROJECT_DIR}/.npm-global"
echo "Setting up NPM global directory at $NPM_GLOBAL_DIR"

if [ -d "$NPM_GLOBAL_DIR" ] && [ "$(ls -A "$NPM_GLOBAL_DIR")" ]; then
  echo "Directory exists and is not empty. Skipping creation."
else
  echo "Directory does not exist or is empty. Creating it..."
  mkdir -p "$NPM_GLOBAL_DIR/bin"
fi

npm config set prefix "$NPM_GLOBAL_DIR"
export PATH="$NPM_GLOBAL_DIR/bin:$PATH"

# Install yarn if missing
if command -v yarn >/dev/null 2>&1; then
  echo "Yarn is already installed. Skipping installation."
else
  echo "Yarn not found. Installing..."
  npm install -g yarn
fi

# Clean up to avoid cache corruption issues
rm -rf node_modules yarn.lock || true
yarn cache clean --all || true
rm -rf ~/.cache/yarn || true
rm -rf .yarn/cache || true
rm -rf node_modules/.cache || true
npm cache clean --force || true

# Print versions
node -v && npm -v && yarn -v

# Add local binaries to PATH
export PATH="$(pwd)/node_modules/.bin:$PATH"

# Install dependencies fresh
yarn install --frozen-lockfile