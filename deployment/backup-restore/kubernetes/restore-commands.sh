#!/bin/bash

# Check if the required arguments are provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Error: Both namespace and backup file arguments are required."
  echo "Usage: $0 <namespace> <backup_file>"
  exit 1
fi

# Set the namespace from the first argument
NAMESPACE=$1
BACKUP_FILE=$2

set -e

SERVICE=${3:-capwiki-app}
DB_USER=${4:-postgres}
DATABASE=${5:-wiki}
CONTAINER_NAME=${6:-postgresql}

# Get the pod name with label 'app.kubernetes.io/name=postgresql' in the provided namespace
DB_POD_NAME=$(kubectl get pod -l app.kubernetes.io/name=postgresql -n "$NAMESPACE" -o jsonpath="{.items[0].metadata.name}")


# Fetch the PostgreSQL password from the Kubernetes secret in the provided namespace
POSTGRES_PASSWORD=$(kubectl get secret capwiki-postgresdb-secret -n "$NAMESPACE" -o jsonpath="{.data.postgresql-password}" | base64 --decode)

# Step 1: Scale down the deployment/service (if applicable, or you can omit this step if you don't have a specific service to stop).
kubectl scale deployment ${SERVICE} --replicas=0 -n ${NAMESPACE}

# Function to execute psql command
execute_psql() {
    local command="$1"
    kubectl exec -i -n $NAMESPACE $DB_POD_NAME -c $CONTAINER_NAME -- bash -c "PGPASSWORD='$POSTGRES_PASSWORD' psql -U '$DB_USER' -c '$command'"
}


# Step 2: Drop the existing database.
execute_psql "DROP DATABASE IF EXISTS $DATABASE;"

# Step 3: Create a new empty database.
execute_psql "CREATE DATABASE $DATABASE;"

# Step 4: Restore the database from the backup file. Use a pipe to pass the backup file from your local machine.
echo "Start restore the database from the backup file"
cat ${BACKUP_FILE} | kubectl exec -i $DB_POD_NAME -n $NAMESPACE  -- bash -c "PGPASSWORD=${POSTGRES_PASSWORD} pg_restore -U ${DB_USER} -d ${DATABASE}"

echo "Restore is done"

# Step 5: Scale the deployment back up (restart the service).
kubectl scale deployment ${SERVICE} --replicas=1 -n ${NAMESPACE}
