#!/bin/bash

# script for provisioning the correct directories on the deployment host

set -e

BASE_PATH=${1:-/tmp}
REMOTE_USER=${2:-deployer}
ENVIRONMENT=${3:-local}

mkdir -p "${BASE_PATH?:err}"
chown ${2}:${2} "${BASE_PATH?:err}"

mkdir -p "${BASE_PATH:?err}/wiki-js/config/${ENVIRONMENT}"
mkdir -p "${BASE_PATH:?err}/wiki-js/config/certs/${ENVIRONMENT}"
mkdir -p "${BASE_PATH:?err}/wiki-js/data/${ENVIRONMENT}"
mkdir -p "${BASE_PATH:?err}/traefik/config/${ENVIRONMENT}"
mkdir -p "${BASE_PATH:?err}/traefik/certs/${ENVIRONMENT}"
mkdir -p "${BASE_PATH:?err}/keycloak/data/${ENVIRONMENT}"
