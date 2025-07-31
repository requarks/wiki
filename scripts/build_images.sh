#!/bin/bash
source image_tag.env
echo "Building Docker image for environment $ENVIRONMENT"
docker build --no-cache --build-arg VERSION="$VERSION" --build-arg RELEASE_DATE="$(date +'%d.%m.%Y')" -f Dockerfile -t "$NEW_IMAGE" .
echo "NEW_IMAGE=$NEW_IMAGE" >> newimage.txt
# Conditionally build the Pandoc image if PANDOC is set to true


if [[ "$PANDOC" == "true" ]]; then
    echo "Building Pandoc Docker image..."
    cd dev/pandoc
    docker build --no-cache -f Dockerfile -t "$NEW_PANDOC_IMAGE" . || { echo "ERROR: Pandoc Docker image build failed!"; exit 1; }
    cd ../..
    echo "NEW_PANDOC_IMAGE=$NEW_PANDOC_IMAGE" >> newimage.txt
    # Check if image exists locally
    if ! docker image inspect "$NEW_PANDOC_IMAGE" > /dev/null 2>&1; then
        echo "ERROR: Pandoc Docker image $NEW_PANDOC_IMAGE was not built!"; exit 1;
    fi
else
    echo "Skipping Pandoc Docker image build as PANDOC is not set to true."
fi
