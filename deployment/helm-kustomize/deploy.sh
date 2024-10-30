#!/bin/bash
# Ensure at least one argument (environment) is provided
if [ "$#" -lt 1 ]; then
  echo "Usage: $0  <environment>  [image] [image_tag]"
  exit 1
fi

# Assign the arguments to variables
ENVIRONMENT=$1
IMAGE=$2
NEW_IMAGE_WITH_TAG=$3


confirm_deployment() {
    read -p "Are you sure you want to deploy to production? (yes/no): " choice
    case "$choice" in
      yes|YES|y|Y ) echo "Proceeding with deployment...";;
      no|NO|n|N ) echo "Deployment aborted."; exit 1;;
      * ) echo "Invalid response. Deployment aborted."; exit 1;;
    esac
}


# Assign the second argument to NAMESPACE, or set a default value based on ENV_DIR
case "$ENVIRONMENT" in
  dev)
    ENV_DIR="environments/dev"
    ;;
  dev1)
    ENV_DIR="environments/dev1"
    ;;  
  staging)
    ENV_DIR="environments/staging"
    ;;
  prod)
    ENV_DIR="environments/prod"
    confirm_deployment
    ;;
  account1)
    ENV_DIR="environments/account1"
    ;;
  account3)
    ENV_DIR="environments/account3"
    ;;
  *)
    echo "Invalid environment. Valid options are: dev, dev1, staging, prod."
    exit 1
    ;;
esac


kubectl kustomize  --enable-helm base > "$ENV_DIR/resources.yaml"

cd "$ENV_DIR"
# Check if IMAGE_REPOSITORY and IMAGE_TAG are provided
if [ -n "$IMAGE" ] && [ -n "$NEW_IMAGE_WITH_TAG" ]; then
  # Update the image in the Deployment manifest using  `kustomize edit set image`
  kustomize edit set image "$IMAGE"="$NEW_IMAGE_WITH_TAG"
  echo "Image updated to ${NEW_IMAGE_WITH_TAG}"
else
  echo "No image update provided. using previous image for deployment"

fi

kubectl create namespace $ENVIRONMENT

kubectl create -n $ENVIRONMENT secret generic capwiki-postgresdb-secret --from-literal=postgresql-password=$(openssl rand -base64 16) --dry-run=client -o yaml | kubeseal > postgresdb-secret.yaml
kubectl create -f postgresdb-secret.yaml
rm postgresdb-secret.yaml

kubectl kustomize  > kustomized_resources.yaml
kubectl apply -f kustomized_resources.yaml
rm resources.yaml
rm kustomized_resources.yaml
