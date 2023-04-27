#!/bin/bash

if ! command -v jq &> /dev/null
then
    echo "'jq' could not be found. Please install this utility"
    exit
fi

if [ -z "$1" ]
then
      echo "Version is required, command usage example: ./build.sh '<version>' <image name> <need push (0 or 1)>"
      exit
fi

if [ -z "$2" ]
then
      echo "Package name is required, command usage example: ./build.sh '<version>' <image name> <need push (0 or 1)>"
      exit
fi

mv package.json pkg-temp.json
jq --arg vs "$1" -r '. + {dev:false, version:$vs}' pkg-temp.json > package.json
rm pkg-temp.json
cat package.json

docker build -f dev/build/Dockerfile -t "$2:$1" .
docker tag "$2:$1" "$2:latest"

if [ "$3" == "1" ]
then
    echo "Pushing to docker registry"
    docker push "$2:$1"
    docker push "$2:latest"
else
    echo "Skipping push images to docker registry"
fi

git checkout package.json
