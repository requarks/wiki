
#!/bin/bash
# Script to promote staging image to production using dynamic VERSION tag
set -e

# VERSION should be set by CI/CD pipeline (from YAML)
if [ -z "$VERSION" ]; then
  echo "ERROR: VERSION not set. Cannot promote staging image to production.";
  exit 1;
fi
echo "Promoting staging image to production with tag: $VERSION"



STAGING_TAG="latest-staging"
PRODUCTION_IMAGE_TAG="$VERSION"

if [ -z "$IMAGE" ]; then
  echo "IMAGE is not set!"
  exit 1
fi

echo "Logging in to Docker registry..."
docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"
echo "Pulling $IMAGE:$STAGING_TAG from registry..."
docker pull "$IMAGE:$STAGING_TAG"

echo "Retagging $IMAGE:$STAGING_TAG to $IMAGE:$PRODUCTION_IMAGE_TAG"
docker tag "$IMAGE:$STAGING_TAG" "$IMAGE:$PRODUCTION_IMAGE_TAG"
echo "Pushing $IMAGE:$PRODUCTION_IMAGE_TAG to registry..."
docker push "$IMAGE:$PRODUCTION_IMAGE_TAG"
echo "Promoted $IMAGE:$STAGING_TAG to $IMAGE:$PRODUCTION_IMAGE_TAG with version $VERSION"
