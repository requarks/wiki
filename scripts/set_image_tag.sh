#!/bin/bash
set -eo pipefail

# Input parameters
ENVIRONMENT="$1"
IMAGE_TAG="${2:-${CI_COMMIT_SHORT_SHA}}"

# Constants
STAGING_IMAGE_TAG="latest-staging"
IMAGE_TAG_BY_ENV=""

# Validate inputs
if [[ -z "$ENVIRONMENT" || -z "$IMAGE_TAG" ]]; then
  echo "ERROR: Missing required arguments"
  echo "Usage: $0 <ENVIRONMENT> <IMAGE_TAG>"
  exit 1
fi

# Determine image tag based on branch and environment
case "$ENVIRONMENT" in
  "staging")
    if [[ "$CI_COMMIT_BRANCH" == "develop" ]]; then
      IMAGE_TAG_BY_ENV="$STAGING_IMAGE_TAG"
    else
      echo "ERROR: Only 'develop' branch can be deployed to staging"
      exit 1
    fi
    ;;
  "dev1"|"dev2")
    if [[ "$CI_COMMIT_BRANCH" =~ ^(feature|task|hotfix|improvement|bugfix|docs)/ ]]; then
      IMAGE_TAG_BY_ENV="${ENVIRONMENT}-${IMAGE_TAG}"
    else
      echo "ERROR: Branch name doesn't match allowed prefixes for dev environment"
      exit 1
    fi
    ;;
  *)
    echo "ERROR: Unknown environment '$ENVIRONMENT'"
    exit 1
    ;;
esac

# Validate we have a tag
if [[ -z "$IMAGE_TAG_BY_ENV" ]]; then
  echo "ERROR: Could not determine image tag for environment $ENVIRONMENT and branch $CI_COMMIT_BRANCH"
  exit 1
fi

# Output results
echo "IMAGE_TAG=$IMAGE_TAG"
echo "IMAGE_TAG_BY_ENV=$IMAGE_TAG_BY_ENV"
echo "Constructing image names..."

# Docker registry login
if ! docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"; then
  echo "ERROR: Docker login failed"
  exit 1
fi

# Set output variables
export NEW_IMAGE="${IMAGE}:${IMAGE_TAG_BY_ENV}"
export NEW_PANDOC_IMAGE="${PANDOC_IMAGE}:${IMAGE_TAG_BY_ENV}"

echo "NEW_IMAGE=${NEW_IMAGE}" >> image_tag.env
echo "NEW_PANDOC_IMAGE=${NEW_PANDOC_IMAGE}" >> image_tag.env

echo "Successfully set image tags:"
echo " - Application image: $NEW_IMAGE"
echo " - Pandoc image: $NEW_PANDOC_IMAGE"