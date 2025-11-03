#!/bin/bash
set -e

docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"

# Promote hotfix image to staging
hotfix_image="${IMAGE}:${HOTFIX_IMAGE_TAG}"
staging_image="${IMAGE}:${STAGING_IMAGE_TAG}"

echo "Promoting hotfix image from ${hotfix_image} to staging (${staging_image})"

if ! docker pull "$hotfix_image"; then
  echo "Error: hotfix image $hotfix_image does not exist or could not be pulled."
  exit 1
fi

docker tag "$hotfix_image" "$staging_image"
docker push "$staging_image"

docker logout "$DOCKER_REGISTRY"
docker rmi "$hotfix_image" "$staging_image"

echo "Hotfix promotion to staging complete."