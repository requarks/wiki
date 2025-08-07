#!/bin/bash
set -e  # Exit immediately on error
docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"
source newimage.txt
echo "Pushing Docker images to registry..."

docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"
echo "Pushing main image: $NEW_IMAGE"
docker push "$NEW_IMAGE"

if [[ "$PANDOC" == "true" ]]; then
  echo "Pushing Pandoc image: $NEW_PANDOC_IMAGE"
  docker push "$NEW_PANDOC_IMAGE"
  docker rmi "$NEW_PANDOC_IMAGE"
fi

docker logout "$DOCKER_REGISTRY"
docker rmi "$NEW_IMAGE"

echo "Docker push completed successfully"
