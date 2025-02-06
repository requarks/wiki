#!/bin/bash

IMAGE_TAG_BY_ENV=""
ENVIRONMENT=$1
IMAGE_TAG=${2:-${CI_COMMIT_SHORT_SHA}}
echo "IMAGE_TAG is set to $IMAGE_TAG"
STAGING_IMAGE_TAG="latest-staging"

# Ensure required arguments are provided
if [[ -z "$ENVIRONMENT" || -z "$IMAGE_TAG" ]]; then
  echo "Usage: $0 <ENVIRONMENT> <IMAGE_TAG>"
  exit 1
fi


# Set IMAGE_TAG_BY_ENV based on branch and check in case of manual trigger
if [[ "$CI_COMMIT_BRANCH" == "develop" ]] ||
        [[ "$CI_PIPELINE_SOURCE" == "web" && "$CI_COMMIT_BRANCH" == "develop" && "$ENVIRONMENT" == "staging" ]]; then
  IMAGE_TAG_BY_ENV="${STAGING_IMAGE_TAG}"
elif [[ "$CI_COMMIT_BRANCH" =~ ^(feature|task|hotfix|improvement|bugfix|docs)/ ]] && [[ "$CI_PIPELINE_SOURCE" == "web" ]]; then
  if [[ "$ENVIRONMENT" == "dev1" ]]; then
    IMAGE_TAG_BY_ENV="dev1-${IMAGE_TAG}"
  elif [[ "$ENVIRONMENT" == "dev2" ]]; then
    IMAGE_TAG_BY_ENV="dev2-${IMAGE_TAG}"
  fi



# Export the variable for use in other scripts
export IMAGE_TAG_BY_ENV
echo "IMAGE_TAG_BY_ENV=$IMAGE_TAG_BY_ENV" >> image_tag.env
