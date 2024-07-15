#!/bin/bash

set -e

SERVICE=${1:-db}
SERVICE_DB=${2:-${SERVICE}-db}
DB_USER=${3:-postgres}
DATABASE=${4:-postgres}

# docker stop ${SERVICE}

mkdir -p 	~/backup/${SERVICE}/

docker exec ${SERVICE_DB} pg_dump -U ${DB_USER} ${DATABASE} -F c > ~/backup/${SERVICE}/backup.dump
