#!/bin/bash

while read -r CHART URL; do
  helm repo add "$CHART" "$URL"
  sleep 2
done < "helm_repos.txt"