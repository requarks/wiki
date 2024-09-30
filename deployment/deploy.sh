#!/bin/bash

# script for the actual deployment of wiki.js and dependencies

set -e

# only sources if local deployment is true checks whether file exists and sources it
if [ -z "$1" ]; then
  echo "Usage: $0 {--local|--dev1 |--prod} [VAR1=value1 VAR2=value2 ...]"
  exit 1
fi

export DEPLOYMENT_HOME=~/mar/deployment

confirm_deployment() {
    read -p "Are you sure you want to deploy to production? (yes/no): " choice
    case "$choice" in
      yes|YES|y|Y ) echo "Proceeding with deployment...";;
      no|NO|n|N ) echo "Deployment aborted."; exit 1;;
      * ) echo "Invalid response. Deployment aborted."; exit 1;;
    esac
}

# Set the environment file based on the flag
case "$1" in
  --local)
    FILE="${DEPLOYMENT_HOME}/env/local/.env.deploy"
    openssl req -x509 \
      -newkey rsa:4096 \
      -keyout ${DEPLOYMENT_HOME}/config/local/certs/traefik_key.pem \
      -out ${DEPLOYMENT_HOME}/config/local/certs/traefik_cert.pem \
      -sha256 -days 3650 -nodes \
      -subj "/C=DE/ST=NRW/L=RATINGEN/O=Capgemini/OU=DevOps/CN=*.localtest.me"
    ;;
  --dev1)
    FILE="${DEPLOYMENT_HOME}/env/dev1/.env.deploy"

    ;;
  --dev2)
    FILE="${DEPLOYMENT_HOME}/env/dev2/.env.deploy"
    ;;
  --staging)
    FILE="${DEPLOYMENT_HOME}/env/staging/.env.deploy"
    ;;
  --prod)
    echo "Production deployment selected."
    FILE="${DEPLOYMENT_HOME}/env/prod/.env.deploy"
    confirm_deployment
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

export DOCKER_COMPOSE_FILE=${DEPLOYMENT_HOME}/docker-compose-wiki.yml
export BASE_PATH=/home/${REMOTE_USER}
export REMOTE_HOST=${REMOTE_USER}@${HOST_NAME}
export DOCKER_HOST=ssh://${REMOTE_HOST} # sets the context to perform the docker commands on
export ENV_PATH=${DEPLOYMENT_HOME}/env/${ENVIRONMENT}

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
ssh ${REMOTE_HOST} 'bash -s' < ${DEPLOYMENT_HOME}/provision.sh "${BASE_PATH}" "${REMOTE_USER}" "${ENVIRONMENT}"

# copy files to target machine
scp -qr ${DEPLOYMENT_HOME}/config/${ENVIRONMENT}/wiki-js.config.yml ${REMOTE_HOST}:${BASE_PATH}/wiki-js/config/${ENVIRONMENT}
scp -qr ${DEPLOYMENT_HOME}/config/${ENVIRONMENT}/certs-traefik.yaml ${REMOTE_HOST}:${BASE_PATH}/traefik/config/${ENVIRONMENT}
scp -qr ${DEPLOYMENT_HOME}/config/${ENVIRONMENT}/certs/ ${REMOTE_HOST}:${BASE_PATH}/traefik/certs/${ENVIRONMENT}
scp -qr ${DEPLOYMENT_HOME}/config/${ENVIRONMENT}/prometheus/* ${REMOTE_HOST}:${BASE_PATH}/prometheus/config/${ENVIRONMENT}
scp -qr ${DEPLOYMENT_HOME}/config/${ENVIRONMENT}/grafana/* ${REMOTE_HOST}:${BASE_PATH}/grafana/config/${ENVIRONMENT}
scp -qr ${DEPLOYMENT_HOME}/config/${ENVIRONMENT}/loki/* ${REMOTE_HOST}:${BASE_PATH}/loki/config/${ENVIRONMENT}
scp -qr ${DEPLOYMENT_HOME}/config/${ENVIRONMENT}/promtail/* ${REMOTE_HOST}:${BASE_PATH}/promtail/config/${ENVIRONMENT}

# executes docker compose file to deploy applications with defined environment variables
if [ "$1" == "--destroy" ]; then
    echo "Destroying Docker Compose services..."
    docker compose -f ${DOCKER_COMPOSE_FILE} \
      --env-file ${ENV_PATH}/.env.wiki-db \
      --env-file ${ENV_PATH}/.env.wiki \
      --env-file ${ENV_PATH}/.env.traefik  \
      --env-file ${ENV_PATH}/.env.keycloak \
      --env-file ${ENV_PATH}/.env.grafana \
      --env-file ${ENV_PATH}/.env.prometheus \
      --env-file ${ENV_PATH}/.env.node-exporter \
      --env-file ${ENV_PATH}/.env.cadvisor \
      --env-file ${ENV_PATH}/.env.loki \
      --env-file ${ENV_PATH}/.env.promtail \
      --profile ${ENVIRONMENT} down
else
    echo "Starting Docker Compose services..."
    docker compose -f ${DOCKER_COMPOSE_FILE} \
      --env-file ${ENV_PATH}/.env.wiki-db \
      --env-file ${ENV_PATH}/.env.wiki \
      --env-file ${ENV_PATH}/.env.traefik  \
      --env-file ${ENV_PATH}/.env.keycloak \
      --env-file ${ENV_PATH}/.env.grafana \
      --env-file ${ENV_PATH}/.env.prometheus \
      --env-file ${ENV_PATH}/.env.node-exporter \
      --env-file ${ENV_PATH}/.env.cadvisor \
      --env-file ${ENV_PATH}/.env.loki \
      --env-file ${ENV_PATH}/.env.promtail \
      --profile ${ENVIRONMENT} up -d --build
    # to build docker image for  wiki with no cache (if previous cmnd buit with cache), so that latest changes will be deployed
    #docker compose  -f ${DOCKER_COMPOSE_FILE}  --env-file ${ENV_PATH}/.env.wiki --profile ${ENVIRONMENT} build  --no-cache wiki 
fi
