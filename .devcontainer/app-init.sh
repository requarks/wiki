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
# server-side rendering back off -- run this block again if the admin area says it is missing. The
# version is the extension definition's, as in the production image.
#
# Then the browser, which `browsers install` fetches if the postinstall did not, and the system
# libraries it lists for itself in `deb.deps` -- the `apt-get satisfy` that `--install-deps` runs, but
# under sudo alone rather than with Puppeteer running as root.
echo "Installing the Puppeteer extension..."
PUPPETEER_VERSION="$(sed -n 's/^installVersion: *//p' modules/extensions/puppeteer/definition.yml)"
npm install --no-save "puppeteer@${PUPPETEER_VERSION}"
PUPPETEER_BROWSER="$(npx puppeteer browsers install chrome-headless-shell --format '{{path}}')"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get satisfy -qy --no-install-recommends \
  "$(paste -sd, "$(dirname "$PUPPETEER_BROWSER")/deb.deps")"

cd ../frontend
npm install
cd ../blocks
npm install
npm run build
cd ..

echo "Ready!"
