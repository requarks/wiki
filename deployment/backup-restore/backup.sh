#!/bin/bash

set -e

# only sources if local deployment is true checks whether file exists and sources it
if [ -z "$1" ]; then
  echo "Usage: $0 {--local|--dev1|--dev2|--staging|--prod} [VAR1=value1 VAR2=value2 ...]"
  exit 1
fi

# Set the environment file based on the flag
case "$1" in
  --dev1)
    FILE="./env/dev1/.env.deploy"
    ;;
  --dev2)
    FILE="./env/dev2/.env.deploy"
    ;;
  --staging)
    FILE="./env/staging/.env.deploy"
    ;;
  --prod)
    FILE="./env/prod/.env.deploy"
    ;;
  *)
    echo "Invalid environment: $1"
    echo "Usage: $0 {--local|--dev1|--dev2|--staging|--prod} [VAR1=value1 VAR2=value2 ...]"
    exit 1
    ;;
esac

# Check if the environment file exists and source it
if [ -f "$FILE" ]; then
  echo "Sourcing environment file: $FILE"
  source "$FILE"
else
  echo "Environment file not found: $FILE"
  exit 1
fi

ACTION="backup"

# Check for command-line arguments
for arg in "$@"; do
    case $arg in
        --restore)
            ACTION="restore"
            shift # Remove --restore from the list of arguments
            ;;
    esac
done

export ENVIRONMENT=${ENVIRONMENT:?"environment not defined"}
export REMOTE_USER=${REMOTE_USER:?"remote user not defined"}

export BASE_PATH=/home/${REMOTE_USER}
export REMOTE_HOST=${REMOTE_USER}@${HOST_NAME}
export ENV_PATH=./env/${ENVIRONMENT}
export BACKUP_FILE=

variables=("ENVIRONMENT" "BACKUP_FILE" "REMOTE_USER" "BASE_PATH" "REMOTE_HOST" "ENV_PATH" "SERVICE" "SERVICE_DB" "DB_USER" "DATABASE")

# Print a header
printf "%-20s : %s\n" "VARIABLE" "VALUE"
printf "%-20s : %s\n" "--------" "-----"

# Iterate through the list of specific environment variables
for var in "${variables[@]}"; do
    # Check if the environment variable is set
    if [[ -n "${!var}" ]]; then
        # Print the environment variable and its value
        printf "%-20s : %s\n" "$var" "${!var}"
    else
        # Handle unset or empty environment variables
        printf "%-20s : %s\n" "$var" "<not set>"
    fi
done

if [ "$1" == "--restore" ]; then
    echo "Performing restore of the database"
    ssh ${REMOTE_HOST} 'bash -s' < ./restore-commands.sh \
      "${SERVICE}" \
      "${SERVICE_DB}" \
      "${DB_USER}" \
      "${DATABASE}" \
      "${BACKUP_FILE}"
else
    echo "Performing back-up of the database "
    ssh ${REMOTE_HOST} 'bash -s' < ./backup-commands.sh \
      "${SERVICE}" \
      "${SERVICE_DB}" \
      "${DB_USER}" \
      "${DATABASE}"
fi
