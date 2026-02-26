#!/bin/bash

# Generate PostgreSQL password
openssl rand -base64 32 > /etc/wiki/.db-secret

# Start containers
if [[ -z $DATABASE_URL ]]; then
  docker start db
fi
docker start wiki
docker start wiki-update-companion

# Remove the ssh force logout command
sed -e '/Match User root/d' \
    -e '/.*ForceCommand.*droplet.*/d' \
    -i /etc/ssh/sshd_config

systemctl restart ssh
