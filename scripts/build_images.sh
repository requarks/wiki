#!/bin/bash
# Script to build Docker images
set -e

echo "Building Docker images..."
# Only source build.env if it exists and is valid
if [ -f build.env ]; then
    grep -E '^[A-Za-z_][A-Za-z0-9_]*=.*$' build.env > build.env.tmp && mv build.env.tmp build.env
    source build.env
fi

echo "Building Docker image for environment $ENVIRONMENT"
NEW_IMAGE="$IMAGE:$IMAGE_TAG"
docker build --no-cache \
        --build-arg NODE_IMAGE="$NODE_IMAGE" \
        --build-arg VERSION="$VERSION" \
        --build-arg RELEASE_DATE="$(date +'%d.%m.%Y')" \
        -f Dockerfile \
        -t "$NEW_IMAGE" .
echo "NEW_IMAGE=$NEW_IMAGE" > newimage.txt

# Build Pandoc image only if dev/pandoc files changed
if git diff --name-only HEAD~1 | grep -q '^dev/pandoc/'; then
    echo "Building Pandoc Docker image..."
    cd dev/pandoc
    docker build --no-cache -f Dockerfile -t "$NEW_PANDOC_IMAGE" .
    cd ../..
    echo "NEW_PANDOC_IMAGE=$NEW_PANDOC_IMAGE" >> newimage.txt
else
    echo "No changes in Pandoc files. Skipping Pandoc image build."
fi