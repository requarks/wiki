#!/bin/bash
#
# Prepares /root/wiki, uploaded by the file provisioner just before this runs. Nothing is started and no
# secret is made here: the first boot of each droplet does both (001-onboot.sh), so that no two droplets
# share a password and the database is seeded on the droplet, not in the image.

set -euo pipefail

cd /root/wiki
chmod 0700 /root/wiki

cat > .env << 'EOF'
# Domain name the wiki is served on over HTTPS, e.g. wiki.example.com. Leave empty to serve plain HTTP
# on the droplet's IP address. Run `wiki-hostname <domain>` rather than editing this by hand, or run
# `docker compose up -d` after changing it.
WIKI_HOSTNAME=
EOF
chmod 0600 .env

chmod +x /usr/local/bin/wiki-hostname
chmod +x /var/lib/cloud/scripts/per-instance/001-onboot.sh
chmod +x /etc/update-motd.d/099-one-click

# -> The secret file only exists from the first boot on; a placeholder lets compose validate the file
mkdir -p secrets
touch secrets/db_password
docker compose config --quiet
rm -rf secrets

# -> Pulled now so that the first boot does not have to
docker compose pull --quiet
