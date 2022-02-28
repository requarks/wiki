#!/bin/bash

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt -qqy update
apt -qqy -o Dpkg::Options::='--force-confdef' -o Dpkg::Options::='--force-confold' install docker-ce docker-ce-cli containerd.io

systemctl enable docker
systemctl start docker

mkdir -p /etc/wiki

docker network create wikinet
docker volume create pgdata
docker create --name=db -e POSTGRES_DB=wiki -e POSTGRES_USER=wiki -e POSTGRES_PASSWORD_FILE=/etc/wiki/.db-secret -v /etc/wiki/.db-secret:/etc/wiki/.db-secret:ro -v pgdata:/var/lib/postgresql/data --restart=unless-stopped -h db --network=wikinet postgres:11
docker create --name=wiki -e DB_TYPE=postgres -e DB_HOST=db -e DB_PORT=5432 -e DB_PASS_FILE=/etc/wiki/.db-secret -v /etc/wiki/.db-secret:/etc/wiki/.db-secret:ro -e DB_USER=wiki -e DB_NAME=wiki -e UPGRADE_COMPANION=1 --restart=unless-stopped -h wiki --network=wikinet -p 80:3000 -p 443:3443 ghcr.io/requarks/wiki:2
docker create --name=wiki-update-companion -v /var/run/docker.sock:/var/run/docker.sock:ro --restart=unless-stopped -h wiki-update-companion --network=wikinet requarks/wiki-update-companion:latest
# docker create --name=nginx-proxy -p 80:80 -p 443:443 -e DEFAULT_HOST=wiki.local --network=wikinet -v /var/run/docker.sock:/tmp/docker.sock:ro --restart=unless-stopped jwilder/nginx-proxy
# docker create --name=watchtower --network=wikinet -v /var/run/docker.sock:/var/run/docker.sock --restart=unless-stopped containrrr/watchtower --cleanup --schedule="0 2 * * 6" wiki
