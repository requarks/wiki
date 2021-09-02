#! /bin/bash

set -e

### Performs a local build of the project                 ###
### Useful for when you require a local/forked full build ###

LOCAL_BUILD_VER=${1:-"local"}
STAGING_DIR=${2:-./dist}

if ! command -v jq &> /dev/null; then echo "jq required!"; exit; fi
cleanup_containers() {
  echo "cleaning 'wiki-builder' containers"
  docker stop wiki-builder && docker rm wiki-builder
}

echo "mutating package.json"
cat <<< "$(jq '.dev |= false' package.json)" > package.json
cat <<< "$(jq '.version |= "local"' package.json)" > package.json

echo "building image requarks/wiki:${LOCAL_BUILD_VER}"
docker build --file dev/build/Dockerfile . --tag requarks/wiki:${LOCAL_BUILD_VER}
rm -rf ${STAGING_DIR} && mkdir -p ${STAGING_DIR}
cleanup_containers || true

echo "compressing files to ${STAGING_DIR}"
docker run --detach --name wiki-builder --entrypoint "/bin/sleep" requarks/wiki:${LOCAL_BUILD_VER} 120
docker exec -it wiki-builder rm /wiki/config.yml
docker cp ./config.sample.yml wiki-builder:/wiki/config.sample.yml
docker exec -u root -w / -it wiki-builder bash -c "tar -czf wiki-js.tar.gz wiki/"
docker cp wiki-builder:wiki-js.tar.gz ${STAGING_DIR}
cleanup_containers

echo "Release files in ${STAGING_DIR}: $(ls ${STAGING_DIR})"