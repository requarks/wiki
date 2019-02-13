#!/bin/sh

echo "Waiting for mariadb to start up..."
bash ./dev/docker-common/wait.sh db:3306
echo "=== READY ==="
tail -f /dev/null
