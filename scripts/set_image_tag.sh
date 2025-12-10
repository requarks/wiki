
#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-none}"
IMAGE_TAG="${2:-${CI_COMMIT_SHORT_SHA:-}}"

IMAGE_TAG_BY_ENV=""

determine_environment() {
  case "${CI_COMMIT_BRANCH:-${CI_COMMIT_REF_NAME:-}}" in
    develop) ENVIRONMENT="dev2" ;;
    main)    ENVIRONMENT="prod" ;;
    feature/*|task/*|hotfix/*|improvement/*|bugfix/*|bug/*|docs/*) ENVIRONMENT="dev1" ;;
  esac
  if [[ "${CI_COMMIT_REF_NAME:-}" =~ ^(hotfix|release)/(.+)$ ]]; then
    ENVIRONMENT="prod"
  fi
}

if [[ "${ENVIRONMENT}" == "none" ]]; then
  determine_environment
fi

echo "Determined ENVIRONMENT=${ENVIRONMENT}"

case "${ENVIRONMENT}" in
  dev1)
    if [[ "${CI_COMMIT_BRANCH:-}" =~ ^(feature|task|hotfix|improvement|bugfix|bug|docs)/ ]]; then
      IMAGE_TAG_BY_ENV="dev1-${IMAGE_TAG}"
    else
      echo "ERROR: Branch name doesn't match allowed prefixes for dev1 environment"; exit 1
    fi
    ;;
  dev2)
    if [[ "${CI_COMMIT_BRANCH:-}" == "develop" ]] || [[ "${CI_COMMIT_BRANCH:-}" =~ ^(feature|task|hotfix|improvement|bugfix|bug|docs)/ ]]; then
      IMAGE_TAG_BY_ENV="dev2-${IMAGE_TAG}"
    else
      echo "ERROR: Branch name doesn't match allowed prefixes for dev2 environment"; exit 1
    fi
    ;;
  prod)
    if [[ "${CI_COMMIT_REF_NAME:-}" =~ ^(hotfix|release)/(.+)$ ]]; then
      IMAGE_TAG_BY_ENV="${BASH_REMATCH[2]}"
      echo "Extracted IMAGE_TAG: ${IMAGE_TAG_BY_ENV}"
    else
      IMAGE_TAG_BY_ENV="${IMAGE_TAG}"
    fi
    ;;
  *)
    echo "ERROR: Unknown environment '${ENVIRONMENT}'"; exit 1
    ;;
esac

if [[ -z "${IMAGE_TAG_BY_ENV}" ]]; then
  echo "ERROR: Could not determine image tag for environment ${ENVIRONMENT} and branch ${CI_COMMIT_BRANCH:-<unset>}"; exit 1
fi

# Compute values used later
export IMAGE_TAG_BY_ENV
export VERSION="${IMAGE_TAG_BY_ENV}"

echo "IMAGE_TAG=${IMAGE_TAG}"
echo "IMAGE_TAG_BY_ENV=${IMAGE_TAG_BY_ENV}"
echo "Constructing image names..."

# Required vars for login and names
: "${DOCKER_REGISTRY:?}"
: "${DOCKER_REGISTRY_USER:?}"
: "${DOCKER_REGISTRY_PASS:?}"
: "${IMAGE:?}"          # e.g., [MASKED]/mar/capwiki
: "${PANDOC_IMAGE:?}"   # e.g., [MASKED]/mar/pandoc

docker login -u "${DOCKER_REGISTRY_USER}" -p "${DOCKER_REGISTRY_PASS}" "${DOCKER_REGISTRY}"

export NEW_IMAGE="${IMAGE}:${IMAGE_TAG_BY_ENV}"
export NEW_PANDOC_IMAGE="${PANDOC_IMAGE}:${IMAGE_TAG_BY_ENV}"

# Write a clean dotenv file
cat > image_tag.env <<EOF
ENVIRONMENT=${ENVIRONMENT}
IMAGE_TAG=${IMAGE_TAG}
IMAGE_TAG_BY_ENV=${IMAGE_TAG_BY_ENV}
VERSION=${VERSION}
NEW_IMAGE=${NEW_IMAGE}
NEW_PANDOC_IMAGE=${NEW_PANDOC_IMAGE}
EOF

echo "Successfully set image tags:"
echo " - Application image: ${NEW_IMAGE}"
echo " - Pandoc image: ${NEW_PANDOC_IMAGE}"
