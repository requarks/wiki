#!/bin/sh

echo "Waiting for mssql to start up..."
bash ./dev/docker-common/wait.sh db:1433
echo "=== READY ==="
tail -f /dev/null
