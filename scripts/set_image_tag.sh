#!/bin/bash

ENVIRONMENT="$1"
IMAGE_TAG="$2"
VERSION="$3"


# Fallback to CI_COMMIT_TAG or CI_COMMIT_SHORT_SHA if IMAGE_TAG is empty
if [ -z "$IMAGE_TAG" ]; then
  IMAGE_TAG="${CI_COMMIT_TAG:-$CI_COMMIT_SHORT_SHA}"
fi

# Auto-determine environment if 'none' is passed
determine_environment() {
  if [ -n "$CI_COMMIT_TAG" ]; then
    ENVIRONMENT="dev2"
    return
  fi
  case "$CI_COMMIT_BRANCH" in
    develop)
      ENVIRONMENT="dev2"
      ;;
    main)
      ENVIRONMENT="prod"
      ;;
    feature/*|task/*|hotfix/*|improvement/*|bugfix/*|bug/*|docs/*)
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

# VERSION must be set by the pipeline (from YAML). Do not override.
if [ -z "$VERSION" ]; then
  echo "ERROR: VERSION is not set. Please provide VERSION from the pipeline YAML."
  exit 1
fi

# Set image tag by environment logic
case "$ENVIRONMENT" in
  dev1)
    IMAGE_TAG_BY_ENV="dev1-${IMAGE_TAG}"
    ;;
  dev2)
    IMAGE_TAG_BY_ENV="dev2-${IMAGE_TAG}"
    DEV_LATEST_TAG="dev-latest"
    ;;
  staging)
    IMAGE_TAG_BY_ENV="latest-staging"
    ;;
  prod|production)
    IMAGE_TAG_BY_ENV="$VERSION"
    ;;
  *)
    echo "ERROR: Unknown environment '$ENVIRONMENT'"
    exit 1
    ;;
esac

echo "CI_COMMIT_TAG=$CI_COMMIT_TAG"
echo "CI_COMMIT_SHORT_SHA=$CI_COMMIT_SHORT_SHA"
echo "Final IMAGE_TAG=$IMAGE_TAG_BY_ENV"
echo "Final VERSION=$VERSION"

echo "Setting image tag for $ENVIRONMENT: $IMAGE_TAG_BY_ENV"
echo "Setting version for $ENVIRONMENT: $VERSION"
echo "IMAGE_TAG=$IMAGE_TAG_BY_ENV" > build.env
echo "VERSION=$VERSION" >> build.env

# For dev2, also set dev-latest for retagging in staging
if [ "$ENVIRONMENT" = "dev2" ]; then
  echo "DEV_LATEST_TAG=$DEV_LATEST_TAG" >> build.env
fi

