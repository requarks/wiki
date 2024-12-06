#!/bin/bash

# Check if the namespace argument is provided
if [ -z "$1" ]; then
  echo "Error: Namespace argument is required."
  echo "Usage: $0 <namespace>"
  exit 1
fi

# Set the namespace from the first argument
NAMESPACE=$1

set -e

DB_USER=${2:-postgres}
DATABASE=${3:-wiki}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backup/postgres/${NAMESPACE}
BACKUP_OUT=${TIMESTAMP}.bck.dump
mkdir -p ${BACKUP_DIR}


# Fetch the PostgreSQL password from the Kubernetes secret in the provided namespace
POSTGRES_PASSWORD=$(kubectl get secret capwiki-postgresdb-secret -n "$NAMESPACE" -o jsonpath="{.data.postgresql-password}" | base64 --decode)

# Get the pod name with label 'app.kubernetes.io/name=postgresql' in the provided namespace
POD_NAME=$(kubectl get pod -l app.kubernetes.io/name=postgresql -n "$NAMESPACE" -o jsonpath="{.items[0].metadata.name}")

# Check if the pod was found
if [ -z "$POD_NAME" ]; then
  echo "Error: No pod with label 'app.kubernetes.io/name=postgresql' found in namespace '$NAMESPACE'."
  exit 1
fi

# Execute pg_dump using the dynamically retrieved pod name and the password from the secret
kubectl exec -i "$POD_NAME" -n "$NAMESPACE" -- bash -c "PGPASSWORD=${POSTGRES_PASSWORD} pg_dump -U ${DB_USER} ${DATABASE} -F c" > ${BACKUP_DIR}/${BACKUP_OUT}

echo "Saved back-up of capwiki-postgres-db to ${BACKUP_DIR}/${BACKUP_OUT}"
