#!/bin/bash
set -e  # Exit immediately on error

docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"

export NEW_IMAGE="${IMAGE}:$IMAGE_TAG_BY_ENV"
echo "Promoting Docker image to release version $VERSION"
echo "Staging Image: $STAGING_IMAGE"

if ! docker pull "$STAGING_IMAGE"; then
  echo "Error: Staging image $STAGING_IMAGE does not exist or could not be pulled."
  exit 1
fi

IMAGE_CREATED=$(docker inspect --format='{{.Created}}' "$STAGING_IMAGE")
echo "Staging Image Created at: $IMAGE_CREATED"

docker tag "$STAGING_IMAGE" "$NEW_IMAGE"
docker push "$NEW_IMAGE"

# Cleanup
docker logout "$DOCKER_REGISTRY"
docker rmi "$STAGING_IMAGE" "$NEW_IMAGE"