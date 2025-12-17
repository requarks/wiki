#!/bin/bash
set -e  # Exit immediately on error
docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"
source newimage.txt
export NEW_IMAGE
echo "Pushing Docker images to registry..."

# Check if main image exists locally before pushing
# if ! docker image inspect "$NEW_IMAGE" > /dev/null 2>&1; then
#   echo "ERROR: Main Docker image $NEW_IMAGE does not exist locally. Aborting push."
#   exit 1
# fi

echo "Pushing main Docker image: $NEW_IMAGE"
docker push "$NEW_IMAGE"


docker logout "$DOCKER_REGISTRY"

echo "Docker push completed successfully"
