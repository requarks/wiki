#!/bin/bash

# Scripts in this directory will be executed by cloud-init on the first boot of droplets
# created from your image.  Things ike generating passwords, configuration requiring IP address
# or other items that will be unique to each instance should be done in scripts here.

openssl rand -base64 32 > /etc/wiki/.db-secret

if [[ -z $DATABASE_URL ]]; then
  docker start db
fi
docker start wiki
docker start wiki-update-companion
# docker start nginx-proxy
# docker start watchtower
