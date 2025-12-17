
#!/bin/bash
# Script to promote dev2 image to staging using dynamic VERSION tag
set -e


# VERSION should be set by CI/CD pipeline (from YAML)
if [ -z "$VERSION" ]; then
  echo "ERROR: VERSION not set. Cannot promote dev2 image to staging.";
  exit 1;
fi
echo "Promoting dev2 image to staging with tag: $VERSION"




# Promote dev2-latest to staging-latest
DEV2_VERSION_TAG="dev2-latest"
STAGING_IMAGE_TAG="staging-latest"

if [ -z "$IMAGE" ]; then
  echo "IMAGE is not set!"
  exit 1
fi

echo "Logging in to Docker registry..."
docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"
echo "Pulling $IMAGE:$DEV2_VERSION_TAG from registry..."
docker pull "$IMAGE:$DEV2_VERSION_TAG"

echo "Retagging $IMAGE:$DEV2_VERSION_TAG to $IMAGE:$STAGING_IMAGE_TAG"
docker tag "$IMAGE:$DEV2_VERSION_TAG" "$IMAGE:$STAGING_IMAGE_TAG"
echo "Pushing $IMAGE:$STAGING_IMAGE_TAG to registry..."
docker push "$IMAGE:$STAGING_IMAGE_TAG"
echo "Promoted $IMAGE:$DEV2_VERSION_TAG to $IMAGE:$STAGING_IMAGE_TAG with version $VERSION"
