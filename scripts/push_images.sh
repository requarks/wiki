#!/bin/bash
set -e  # Exit immediately on error

# Load Docker image names from the build step
source newimage.txt

# Ensure PANDOC is passed in or default to false
PANDOC=${PANDOC:-false}

echo "Logging into Docker registry..."
docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"

# Check if main image exists locally before pushing
# if ! docker image inspect "$NEW_IMAGE" > /dev/null 2>&1; then
#   echo "ERROR: Main Docker image $NEW_IMAGE does not exist locally. Aborting push."
#   exit 1
# fi

echo "Pushing main Docker image: $NEW_IMAGE"
docker push "$NEW_IMAGE"
docker rmi "$NEW_IMAGE"

# Push Pandoc image if it is enabled
if [[ "$PANDOC" == "true" ]]; then
  if [[ -z "$NEW_PANDOC_IMAGE" ]]; then
    echo "ERROR: PANDOC=true but NEW_PANDOC_IMAGE is not set. Aborting."
    exit 1
  fi
  # Check if image exists locally before pushing
  if ! docker image inspect "$NEW_PANDOC_IMAGE" > /dev/null 2>&1; then
    echo "ERROR: Pandoc Docker image $NEW_PANDOC_IMAGE does not exist locally. Aborting push."; exit 1;
  fi
  echo "Pushing Pandoc Docker image: $NEW_PANDOC_IMAGE"
  docker push "$NEW_PANDOC_IMAGE"
  docker rmi "$NEW_PANDOC_IMAGE"
else
  echo "Skipping Pandoc Docker image push (PANDOC=false)"
fi

docker logout "$DOCKER_REGISTRY"
echo "Docker push completed successfully"
