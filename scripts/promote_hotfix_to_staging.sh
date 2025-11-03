#!/bin/bash
set -e

docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"

# Promote hotfix image to staging
hotfix_image="${IMAGE}:${HOTFIX_IMAGE_TAG}"
staging_image="${IMAGE}:${STAGING_IMAGE_TAG}"

echo "Promoting hotfix image from ${hotfix_image} to staging (${staging_image})"

# Check if the image exists in the registry before trying to pull
echo "Checking if image exists in registry..."
if ! docker manifest inspect "$hotfix_image" > /dev/null 2>&1; then
  echo "Error: hotfix image $hotfix_image does not exist in the registry."
  echo "Available tags for this repository:"
  # Try to list available tags (this might not work with all registries)
  docker images | grep "${IMAGE%:*}" || echo "Could not list available images"
  exit 1
fi

echo "Image exists in registry, pulling..."
if ! docker pull "$hotfix_image"; then
  echo "Error: hotfix image $hotfix_image could not be pulled."
  exit 1
fi

docker tag "$hotfix_image" "$staging_image"
docker push "$staging_image"

docker logout "$DOCKER_REGISTRY"
docker rmi "$hotfix_image" "$staging_image"

echo "Hotfix promotion to staging complete."