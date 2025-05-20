#!/bin/bash

export PATH="$NPM_GLOBAL_DIR/bin:$PATH"
yarn cache clean
rm -rf node_modules
rm -rf yarn.lock yarn.lock
yarn install --frozen-lockfile --force
yarn build