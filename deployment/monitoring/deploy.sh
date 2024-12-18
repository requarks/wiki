#!/bin/bash

# Define variables
NAMESPACE="monitoring"
RELEASE_NAME=("capwiki-prometheus" "prometheus-blackbox" "loki")
CHARTS=("prometheus-community/kube-prometheus-stack" "prometheus-community/prometheus-blackbox-exporter" "grafana/loki-stack")
VALUES_FILES=("values-capwiki-kube-prom.yaml" "values-blackbox-exporter.yaml" "values-loki.yaml")
VERSION=("65.3.1" "9.0.1" "2.10.2")
KUBERNETES_CLUSTER=$1

echo "Helm version is: $(helm version)"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

kubectl create namespace $NAMESPACE
kubectl create -f capwiki-grafanaui-secret.yaml -n $NAMESPACE

# Function to deploy a Helm chart
deploy_chart() {
  local release_name=$1
  local chart=$2
  local version=$3
  local values_file=$4
 
  helm upgrade --install $release_name $chart  --version $version -f $values_file -n $NAMESPACE --create-namespace
}

# Loop through charts and deploy them
for i in "${!CHARTS[@]}"; do
  deploy_chart "${RELEASE_NAME[$i]}" "${CHARTS[$i]}" "${VERSION[$i]}" "${VALUES_FILES[$i]}"
done

kubectl apply -f monitoring-capwiki-tls-secret.yaml -n $NAMESPACE

## based on "ingress-cluster", create ingress respectively
case "$KUBERNETES_CLUSTER" in
  dev1)
    kubectl apply -f monitoring-ingress-dev1-cluster.yaml -n $NAMESPACE
    ;;
  dev2)
    kubectl apply -f monitoring-ingress-dev2-cluster.yaml -n $NAMESPACE
    ;;  
  staging)
    kubectl apply -f monitoring-ingress-staging-cluster.yaml -n $NAMESPACE
    ;;
  prod)
    kubectl apply -f monitoring-ingress-prod-cluster.yaml -n $NAMESPACE
    helm upgrade --install capwiki-prometheus prometheus-community/kube-prometheus-stack  --version 65.3.1 -f values-loki-prod.yaml -n $NAMESPACE
    ;;
  *)
    echo "Invalid environment. Valid options are: dev1, dev2, staging, prod"
    exit 1
    ;;
esac
