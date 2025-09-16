#!/bin/bash
set -e

docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"

# Promote dev2 image to staging
dev2_image="${IMAGE}:${DEV2_IMAGE_TAG}"
staging_image="${IMAGE}:${STAGING_IMAGE_TAG}"

echo "Promoting image from dev2 ($dev2_image) to staging ($staging_image)"

if ! docker pull "$dev2_image"; then
  echo "Error: dev2 image $dev2_image does not exist or could not be pulled."
  exit 1
fi

docker tag "$dev2_image" "$staging_image"
docker push "$staging_image"

docker logout "$DOCKER_REGISTRY"
docker rmi "$dev2_image" "$staging_image"

echo "Promotion to staging complete."
