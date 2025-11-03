#!/bin/bash
set -e

dev2_image="${IMAGE}:${DEV2_IMAGE_TAG}"
docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"

# Generic promotion supporting dev2 (legacy) and hotfix/bugfix direct tags
SOURCE_TAG="${SOURCE_IMAGE_TAG:-${DEV2_IMAGE_TAG}}"

if [ -z "$SOURCE_TAG" ]; then
  echo "ERROR: SOURCE_IMAGE_TAG/DEV2_IMAGE_TAG not provided to promotion script." >&2
  exit 1
fi

source_image="${IMAGE}:${SOURCE_TAG}"
staging_image="${IMAGE}:${STAGING_IMAGE_TAG}"

echo "Promoting image $source_image to staging tag $staging_image"

if ! docker pull "$source_image"; then
  echo "Error: source image $source_image does not exist or could not be pulled." >&2
  exit 1
fi

docker tag "$source_image" "$staging_image"
docker push "$staging_image"

docker logout "$DOCKER_REGISTRY"
docker rmi "$source_image" "$staging_image" || true

echo "Promotion to staging complete (source tag: $SOURCE_TAG)."
