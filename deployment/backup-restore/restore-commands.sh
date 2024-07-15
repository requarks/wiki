#!/bin/bash

set -e

SERVICE=${1:-db}
SERVICE_DB=${2:-${SERVICE}-db}
DB_USER=${3:-postgres}
DATABASE=${4:-postgres}
BACKUP_FILE=${5:-backup.dump}

docker stop ${SERVICE}

docker exec ${SERVICE_DB} dropdb -U ${DB_USER} ${DATABASE}

docker exec ${SERVICE_DB} createdb -U ${DB_USER} ${DATABASE}

cat ~/backup/${SERVICE}/${BACKUP_FILE} | docker exec -i ${SERVICE_DB} pg_restore -U ${DB_USER} -d ${DATABASE}

docker start ${SERVICE}
