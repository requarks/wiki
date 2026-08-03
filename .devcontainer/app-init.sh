#!/bin/bash

cd /workspace

echo "Disabling git info in terminal..."
git config codespaces-theme.hide-status 1
git config devcontainers-theme.hide-status 1
git config oh-my-zsh.hide-info 1

echo "Waiting for DB container to come online..."
/usr/local/bin/wait-for localhost:5432 -- echo "DB ready"

echo "Installing dependencies..."
cd backend
npm install

# The Puppeteer extension, which server-side page rendering needs. Installed here rather than in the
# Dockerfile because node_modules lives in the bind-mounted workspace, and anything the image put there
# would disappear under the mount. Kept out of package.json on purpose: it is an optional extension,
# and a plain source checkout should not have to fetch it to install the backend.
#
# `--no-save` leaves package.json alone, which also means a later reinstall can prune it and turn
# server-side rendering back off -- run this line again if the admin area says it is missing. The
# browser itself is in the image, so this fetches no Chromium (see PUPPETEER_* in the Dockerfile).
echo "Installing the Puppeteer extension..."
npm install --no-save puppeteer@25.4.0

cd ../frontend
npm install
cd ../blocks
npm install
npm run build
cd ..

echo "Ready!"
