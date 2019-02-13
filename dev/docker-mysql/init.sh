#!/bin/sh

echo "Waiting for mysql to start up..."
bash ./dev/docker-common/wait.sh db:3306
echo "=== READY ==="
tail -f /dev/null
