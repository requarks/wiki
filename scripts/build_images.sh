
#!/usr/bin/env bash
set -euo pipefail

# Load vars from previous step
source image_tag.env

: "${ENVIRONMENT:?ENVIRONMENT is required}"
: "${VERSION:?VERSION is required}"
: "${NEW_IMAGE:?NEW_IMAGE is required}"

echo "Building Docker image for environment $ENVIRONMENT"
echo "VERSION=$VERSION"

docker build --no-cache --build-arg NODE_IMAGE="$NODE_IMAGE" --build-arg VERSION="$VERSION" --build-arg RELEASE_DATE="$(date +'%d.%m.%Y')" -f Dockerfile -t "$NEW_IMAGE" .
echo "NEW_IMAGE=$NEW_IMAGE" >> newimage.txt

# Optional Pandoc
if [[ "${PANDOC:-false}" == "true" ]]; then
  : "${NEW_PANDOC_IMAGE:?NEW_PANDOC_IMAGE is required when PANDOC=true}"
  echo "Building Pandoc Docker image..."
  cd dev/pandoc
  docker build --no-cache -f Dockerfile -t "$NEW_PANDOC_IMAGE" .
  cd ../..
  echo "NEW_PANDOC_IMAGE=$NEW_PANDOC_IMAGE" >> newimage.txt
else
  echo "Skipping Pandoc Docker image build as PANDOC is not set to true."
