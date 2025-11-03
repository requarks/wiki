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
      ENVIRONMENT="dev2"
      ;;
    main)
      # Check if this is a hotfix merge to main
      if [[ "$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME" =~ ^hotfix/ ]]; then
        ENVIRONMENT="hotfix"
      else
        ENVIRONMENT="prod"
      fi
      ;;
    feature/*|task/*|hotfix/*|improvement/*|bugfix/*|docs/*)
      ENVIRONMENT="dev1"
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
  dev1)
    if [[ "$CI_COMMIT_BRANCH" =~ ^(feature|task|hotfix|improvement|bugfix|docs)/ ]]; then
      IMAGE_TAG_BY_ENV="dev1-${IMAGE_TAG}"
    else
      echo "ERROR: Branch name doesn't match allowed prefixes for dev1 environment"
      exit 1
    fi
    ;;
  dev2)
    if [[ "$CI_COMMIT_BRANCH" == "develop" ]]; then
      IMAGE_TAG_BY_ENV="dev2-${IMAGE_TAG}"
    elif [[ "$CI_COMMIT_BRANCH" =~ ^(feature|task|hotfix|improvement|bugfix|docs)/ ]]; then
      IMAGE_TAG_BY_ENV="dev2-${IMAGE_TAG}"
    else
      echo "ERROR: Branch name doesn't match allowed prefixes for dev2 environment"
      exit 1
    fi
    ;;
  hotfix)
    # For hotfix branches merged to main, create a hotfix-specific tag
    if [[ "$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME" =~ ^hotfix/(.+)$ ]]; then
      HOTFIX_NAME="${BASH_REMATCH[1]}"
      IMAGE_TAG_BY_ENV="hotfix-${HOTFIX_NAME}-${IMAGE_TAG}"
      echo "Hotfix branch detected: $CI_MERGE_REQUEST_SOURCE_BRANCH_NAME"
      echo "Generated hotfix IMAGE_TAG: $IMAGE_TAG_BY_ENV"
    else
      IMAGE_TAG_BY_ENV="hotfix-${IMAGE_TAG}"
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
