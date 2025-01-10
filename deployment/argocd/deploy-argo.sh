#!/bin/bash

if [ "$#" -lt 1 ]; then
  echo "Usage: $0  <environment>"
  exit 1
fi

NAMESPACE="argocd"
ENVIRONMENT=$1

kubectl create namespace $NAMESPACE
kubectl apply -f capwiki/appproject.yaml
kubectl apply -f capwiki/capwiki-deploy-repository.yaml


case "$ENVIRONMENT" in
  dev1)
    kubectl apply -f capwiki/applications/dev1.yaml
    ;;
  dev2)
    kubectl apply -f capwiki/applications/dev2.yaml
    ;;
  staging)
    kubectl apply -f capwiki/applications/stage.yaml
    ;;
  prod)
    kubectl apply -f capwiki/applications/prod.yaml
    ;;
  *)
    echo "Invalid environment. Valid options are: dev, dev1, staging, prod."
    exit 1
    ;;
esac

### image updater 
kubectl apply -n $NAMESPACE -f capwiki/argocd-nexus-secret.yaml
kubectl apply -n $NAMESPACE -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml