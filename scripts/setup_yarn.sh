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

# Clean Yarn cache to avoid corrupt package issues
yarn cache clean || true
rm -rf ~/.cache/yarn || true

# Print versions
node -v && npm -v && yarn -v
