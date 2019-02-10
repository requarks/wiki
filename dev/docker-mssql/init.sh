#!/bin/sh

echo "Waiting for redis and mssql to start up..."
bash ./dev/docker-common/wait.sh redis:6379
bash ./dev/docker-common/wait.sh db:1433
echo "=== READY ==="
tail -f /dev/null
