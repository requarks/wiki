#!/bin/bash

# script for the actual deployment of wiki.js and dependencies

set -e

# only sources if local deployment is true checks whether file exists and sources it
if [ -z "$1" ]; then
  echo "Usage: $0 {--local|--dev1|--dev2|--staging|--prod} [VAR1=value1 VAR2=value2 ...]"
  exit 1
fi

# Set the environment file based on the flag
case "$1" in
  --local)
    FILE="./env/local/.env.deploy"
    openssl req -x509 \
      -newkey rsa:4096 \
      -keyout ./config/local/certs/traefik_key.pem \
      -out ./config/local/certs/traefik_cert.pem \
      -sha256 -days 3650 -nodes \
      -subj "/C=DE/ST=NRW/L=RATINGEN/O=Capgemini/OU=DevOps/CN=*.localtest.me"
    ;;
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

ACTION="start"

# Check for command-line arguments
for arg in "$@"; do
    case $arg in
        --destroy)
            ACTION="destroy"
            shift # Remove --destroy from the list of arguments
            ;;
    esac
done

export ENVIRONMENT=${ENVIRONMENT:?"environment not defined"}
export REMOTE_USER=${REMOTE_USER:?"remote user not defined"}

export DOCKER_COMPOSE_FILE=./docker-compose-wiki.yml
export BASE_PATH=/home/${REMOTE_USER}
export REMOTE_HOST=${REMOTE_USER}@${HOST_NAME}
export DOCKER_HOST=ssh://${REMOTE_HOST} # sets the context to perform the docker commands on
export ENV_PATH=./env/${ENVIRONMENT}

variables=("ENVIRONMENT" "BASE_PATH" "REMOTE_USER" "REMOTE_HOST" "DOCKER_COMPOSE_FILE" "DOCKER_HOST" "ENV_PATH" "HOST_NAME")

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

# checks whether file exists and sources it
FILE=${ENV_PATH}/secrets/.env.secrets && test -f $FILE && source $FILE

# execute provision script on target machine
ssh ${REMOTE_HOST} 'bash -s' < ./provision.sh "${BASE_PATH}" "${REMOTE_USER}" "${ENVIRONMENT}"

# copy files to target machine
scp -qr ./config/${ENVIRONMENT}/wiki-js.config.yml ${REMOTE_HOST}:${BASE_PATH}/wiki-js/config/${ENVIRONMENT}
scp -qr ./config/${ENVIRONMENT}/certs-traefik.yaml ${REMOTE_HOST}:${BASE_PATH}/traefik/config/${ENVIRONMENT}
scp -qr ./config/${ENVIRONMENT}/certs/ ${REMOTE_HOST}:${BASE_PATH}/traefik/certs/${ENVIRONMENT}

# executes docker compose file to deploy applications with defined environment variables
if [ "$1" == "--destroy" ]; then
    echo "Destroying Docker Compose services..."
    docker compose -f ${DOCKER_COMPOSE_FILE} \
      --env-file ${ENV_PATH}/.env.wiki-db \
      --env-file ${ENV_PATH}/.env.wiki \
      --env-file ${ENV_PATH}/.env.traefik  \
      --env-file ${ENV_PATH}/.env.keycloak \
      down
else
    echo "Starting Docker Compose services..."
    docker compose -f ${DOCKER_COMPOSE_FILE} \
      --env-file ${ENV_PATH}/.env.wiki-db \
      --env-file ${ENV_PATH}/.env.wiki \
      --env-file ${ENV_PATH}/.env.traefik  \
      --env-file ${ENV_PATH}/.env.keycloak \
      --profile ${ENVIRONMENT} up -d --build
fi
