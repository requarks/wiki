#!/bin/bash

cd /workspace

echo "Disabling git info in terminal..."
git config codespaces-theme.hide-status 1
git config oh-my-zsh.hide-info 1

echo "Waiting for DB container to come online..."
/usr/local/bin/wait-for localhost:5432 -- echo "DB ready"

npm install -g npm-check-updates

echo "Installing dependencies..."
cd server
npm install
cd ../ux
npm install
cd ../blocks
npm install
npm run build
cd ..

echo "Ready!"
