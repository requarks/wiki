#!/bin/sh

echo "Waiting for redis to start up..."
bash ./dev/docker-common/wait.sh redis:6379
echo "=== READY ==="
tail -f /dev/null
