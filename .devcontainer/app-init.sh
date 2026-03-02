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
cd ../frontend
npm install
cd ../blocks
npm install
npm build
cd ..

echo "Ready!"
