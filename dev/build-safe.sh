#!/usr/bin/env bash
#
# Resource-capped local build for wikijs-ng.
#
# Webpack production builds (Terser workers + Node heap) can consume several GB
# and push a busy host into swap thrashing — killing SSH sessions or triggering
# the kernel OOM killer on OTHER processes. This wrapper confines the build to
# a systemd scope that is throttled (MemoryHigh) before it is killed (MemoryMax),
# runs at low CPU/IO priority, and caps the Node heap.
#
# Usage: dev/build-safe.sh [yarn-script]   (default: build)
set -euo pipefail

SCRIPT="${1:-build}"

exec systemd-run --user --scope -q \
  -p MemoryHigh=2200M \
  -p MemoryMax=2800M \
  -p CPUQuota=200% \
  -p CPUWeight=20 \
  -p IOWeight=20 \
  env NODE_OPTIONS=--max-old-space-size=1280 \
  nice -n 19 yarn "$SCRIPT"
