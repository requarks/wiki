#!/bin/sh

echo "Waiting for redis and postgres to start up..."
bash ./dev/docker-common/wait.sh redis:6379
bash ./dev/docker-common/wait.sh db:5432
echo "=== READY ==="
tail -f /dev/null
