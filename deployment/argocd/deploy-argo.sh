#!/bin/bash

if [ "$#" -lt 1 ]; then
  echo "Usage: $0  <environment>"
  exit 1
fi

NAMESPACE="argocd"
ENVIRONMENT=$1

kubectl create namespace $NAMESPACE
kubectl apply -k https://github.com/argoproj/argo-cd/manifests/crds\?ref\=stable
kubectl apply -f argocd-provisioning-manifests/

case "$ENVIRONMENT" in
  dev1)
    kubectl apply -f argocd-provisioning-manifests/applications/dev1.yaml
    ;;
  dev2)
    kubectl apply -f argocd-provisioning-manifests/applications/dev2.yaml
    ;;
  staging)
    kubectl apply -f argocd-provisioning-manifests/applications/stage.yaml
    ;;
  prod)
    kubectl apply -f argocd-provisioning-manifests/applications/prod.yaml
    ;;
  *)
    echo "Invalid environment. Valid options are: dev, dev1, staging, prod."
    exit 1
    ;;
esac
