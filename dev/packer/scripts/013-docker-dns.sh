#!/bin/sh

sed -e 's|#DOCKER_OPTS|DOCKER_OPTS|g' \
    -i /etc/default/docker
