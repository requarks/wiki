#!/bin/sh

echo "Waiting for postgres to start up..."
bash ./dev/docker-common/wait.sh db:5432
echo "=== READY ==="
tail -f /dev/null
