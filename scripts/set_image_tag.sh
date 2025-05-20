#!/bin/bash
set -eo pipefail

# Input parameters
ENVIRONMENT="$1"
IMAGE_TAG="${2:-${CI_COMMIT_SHORT_SHA}}"

# Constants
STAGING_IMAGE_TAG="latest-staging"
IMAGE_TAG_BY_ENV=""

# Auto-determine environment if 'none' is passed
determine_environment() {
  case "$CI_COMMIT_BRANCH" in
    develop)
      ENVIRONMENT="staging"
      ;;
    main)
      ENVIRONMENT="prod"
      ;;
    feature/*|task/*|hotfix/*|improvement/*|bugfix/*|docs/*)
      ENVIRONMENT="dev2"
      ;;
  esac

  if [[ "$CI_COMMIT_REF_NAME" =~ ^(hotfix|release)/(.+)$ ]]; then
    ENVIRONMENT="prod"
  fi
}

if [[ "$ENVIRONMENT" == "none" ]]; then
  determine_environment
fi

echo "Determined ENVIRONMENT=$ENVIRONMENT"

# Determine image tag based on environment
case "$ENVIRONMENT" in
  staging)
    if [[ "$CI_COMMIT_BRANCH" == "develop" ]]; then
      IMAGE_TAG_BY_ENV="$STAGING_IMAGE_TAG"
    else
      echo "ERROR: Only 'develop' branch can be deployed to staging"
      exit 1
    fi
    ;;
  dev1|dev2)
    if [[ "$CI_COMMIT_BRANCH" =~ ^(feature|task|hotfix|improvement|bugfix|docs)/ ]]; then
      IMAGE_TAG_BY_ENV="${ENVIRONMENT}-${IMAGE_TAG}"
    else
      echo "ERROR: Branch name doesn't match allowed prefixes for dev environment"
      exit 1
    fi
    ;;
  prod)
    if [[ "$CI_COMMIT_REF_NAME" =~ ^(hotfix|release)/(.+)$ ]]; then
      IMAGE_TAG_BY_ENV="${BASH_REMATCH[2]}"
      echo "Extracted IMAGE_TAG: $IMAGE_TAG_BY_ENV"
    else
      IMAGE_TAG_BY_ENV="$IMAGE_TAG"
    fi
    ;;
  *)
    echo "ERROR: Unknown environment '$ENVIRONMENT'"
    exit 1
    ;;
esac

# Final validation
if [[ -z "$IMAGE_TAG_BY_ENV" ]]; then
  echo "ERROR: Could not determine image tag for environment $ENVIRONMENT and branch $CI_COMMIT_BRANCH"
  exit 1
fi

# Output results
echo "IMAGE_TAG=$IMAGE_TAG"
echo "IMAGE_TAG_BY_ENV=$IMAGE_TAG_BY_ENV"
echo "Constructing image names..."

# Docker login
if ! docker login -u "$DOCKER_REGISTRY_USER" -p "$DOCKER_REGISTRY_PASS" "$DOCKER_REGISTRY"; then
  echo "ERROR: Docker login failed"
  exit 1
fi

# Set and export image names
export NEW_IMAGE="${IMAGE}:${IMAGE_TAG_BY_ENV}"
export NEW_PANDOC_IMAGE="${PANDOC_IMAGE}:${IMAGE_TAG_BY_ENV}"

echo "NEW_IMAGE=${NEW_IMAGE}" >> image_tag.env
echo "NEW_PANDOC_IMAGE=${NEW_PANDOC_IMAGE}" >> image_tag.env

echo "Successfully set image tags:"
echo " - Application image: $NEW_IMAGE"
echo " - Pandoc image: $NEW_PANDOC_IMAGE"
