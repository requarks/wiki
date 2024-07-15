#!/bin/bash

set -e

SERVICE=${1:-wiki}
SERVICE_DB=${2:-${SERVICE}-db}
DB_USER=${3:-postgres}
DATABASE=${4:-wiki}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backup/${SERVICE}
BACKUP_OUT=${TIMESTAMP}_${SERVICE}.bck.dump

mkdir -p ${BACKUP_DIR}

docker exec ${SERVICE_DB} pg_dump -U ${DB_USER} ${DATABASE} -F c > ${BACKUP_DIR}/${BACKUP_OUT}

echo "Saved back-up of ${SERVICE} to ${BACKUP_DIR}/${BACKUP_OUT}"
