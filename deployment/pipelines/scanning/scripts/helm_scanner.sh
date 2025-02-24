#!/bin/bash

# Create a temporary file for all_images.txt
ALL_IMAGES=$(mktemp)

# Ensure the temporary file is deleted on exit
trap 'rm -f $ALL_IMAGES' EXIT

# Read helm charts and versions, generate image files
while read -r CHART VERSION; do
  IMG_FILE=$(mktemp)
  helm images --version "$VERSION" get "$CHART" > "$IMG_FILE"
  echo "$IMG_FILE" >> "$ALL_IMAGES"
done < "helm_charts.txt"

# Generate reports for each image
while read -r IMG_FILE; do
  while read -r IMAGE; do
    IMG_SHORT=$(echo $IMAGE | awk -F[/:] '{print $(NF-1)}') # extract the image name without path or version/tag
    echo "### GENERATING JSON REPORTS ###"
    trivy image --scanners vuln --no-progress --timeout 30m --format json --output trivy-report-${IMG_SHORT}.json $IMAGE
    echo "### GENERATING HTML REPORTS ###"
    trivy convert --format template --template "@/contrib/html.tpl" --output trivy-report-${IMG_SHORT}.html trivy-report-${IMG_SHORT}.json
  done < "$IMG_FILE"
done < "$ALL_IMAGES"