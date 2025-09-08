#!/bin/bash
set -e  # Exit immediately on error


docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"

export NEW_IMAGE="${IMAGE}:$IMAGE_TAG"
echo "Promoting Docker image and capwiki app new to release version $VERSION"
echo "Source Image (from staging): $STAGING_IMAGE"

if ! docker pull "$STAGING_IMAGE"; then
  echo "Error: Source image $STAGING_IMAGE (from staging) does not exist or could not be pulled."
  exit 1
fi

docker tag "$STAGING_IMAGE" "$NEW_IMAGE"
docker push "$NEW_IMAGE"


if [[ "$PANDOC" == "true" && "$ENVIRONMENT" == "production" ]]; then
  export STAGING_PANDOC_IMAGE="${PANDOC_IMAGE}:${STAGING_IMAGE_TAG}"
  echo "Pandoc Source Image (from staging): $STAGING_PANDOC_IMAGE"
  export PROD_PANDOC_IMAGE="${PANDOC_IMAGE}:${IMAGE_TAG}"
  echo "Promoting Pandoc image to release version $PROD_PANDOC_IMAGE"

  if ! docker pull "$STAGING_PANDOC_IMAGE"; then
    echo "Error: Source image $STAGING_PANDOC_IMAGE (from staging) does not exist or could not be pulled."
    exit 1
  fi

  docker tag "$STAGING_PANDOC_IMAGE" "$PROD_PANDOC_IMAGE"
  docker push "$PROD_PANDOC_IMAGE"
  docker rmi "$STAGING_PANDOC_IMAGE" "$PROD_PANDOC_IMAGE"
fi

# Cleanup
docker logout "$DOCKER_REGISTRY"
docker rmi "$STAGING_IMAGE" "$NEW_IMAGE"
