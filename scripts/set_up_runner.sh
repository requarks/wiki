#!/bin/bash

export PATH="$NPM_GLOBAL_DIR/bin:$PATH"
yarn cache clean --all
rm -rf node_modules
yarn install --frozen-lockfile --force
yarn build