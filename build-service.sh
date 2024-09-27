#!/bin/bash

# Check if platform argument is provided
if [ -z "$1" ]; then
  echo "Error: Platform argument is required."
  echo "Usage: $0 <platform>"
  echo "Example: $0 linux/amd64"
  exit 1
fi

# Assign the first argument to PLATFORM
PLATFORM=$1

# Function to check if Docker is running
check_docker_running() {
  if ! docker info >/dev/null 2>&1; then
    echo "Error: Docker is not running. Please make sure Docker is installed and running before running this script."
    exit 1
  fi
}

# Call the function to check Docker status
check_docker_running

# Generate a unique tag using today's date and an optional index (e.g., 20230901-1)
TAG=$(date +"%Y%m%d_%H%M%S")

# Login to the Azure Container registry
az acr login --name acruicwiki

# Build the Docker image with the specified platform
docker build --platform "$PLATFORM" -t acruicwiki.azurecr.io/uic-wiki:$TAG -f dev/build/Dockerfile .

# Push the Docker image to the registry
docker push acruicwiki.azurecr.io/uic-wiki:$TAG

# Update the container app with the new image
# az containerapp update \
#   --name ca-uic-wiki \
#   --resource-group rg-uic-wiki \
#   --image acruicwiki.azurecr.io/uic-wiki:$TAG
