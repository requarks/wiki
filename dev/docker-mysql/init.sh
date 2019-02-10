#!/bin/sh

echo "Waiting for redis and mysql to start up..."
bash ./dev/docker-common/wait.sh redis:6379
bash ./dev/docker-common/wait.sh db:3306
echo "=== READY ==="
tail -f /dev/null
