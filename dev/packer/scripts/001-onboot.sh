#!/bin/bash
#
# Run by cloud-init once, on the first boot of every droplet created from this image. Everything
# unique to a droplet is made here and never baked into the image, so that no two droplets share a
# password.

set -euo pipefail

# -> The image turns root SSH logins away until this script is done (890-force-ssh-logout.sh), so that
#    nobody signs in before the credentials file exists. Lifted on exit regardless of whether the
#    script succeeded, since a failure part way would otherwise lock root out of the droplet for good.
allow_ssh_login() {
  sed -e '/^Match User root$/d' -e '/ForceCommand echo "Please wait while we get your droplet ready..."/d' \
    -i /etc/ssh/sshd_config
  systemctl try-reload-or-restart ssh.service || true
}
trap allow_ssh_login EXIT

WIKI_DIR=/root/wiki
CREDENTIALS_FILE=/root/wiki-admin.txt

random_password() {
  tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$1" || true
}

cd "$WIKI_DIR"

# -> Database password, handed to both postgres and the wiki as a compose secret. A compose secret is a
#    bind mount that keeps the file's mode, and the containers read it as their own users (postgres,
#    node), so the file is world-readable and the directory around it is not.
install -d -m 0700 secrets
random_password 40 > secrets/db_password
chmod 0644 secrets/db_password

# -> Administrator password, used once to seed the account
admin_password=$(random_password 20)

public_ip=$(curl -fsS --max-time 5 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address || hostname -I | awk '{ print $1 }')

umask 077
cat > "$CREDENTIALS_FILE" << EOF
Wiki.js - Administrator Account
===============================

Open http://${public_ip}/ in your browser and sign in with:

  Email:     admin@example.com
  Password:  ${admin_password}

After signing in for the first time:

  - Change this password: open your profile from the avatar menu,
    then Authentication -> Change Password.
  - Change the email address to your own: Administration Area -> Users,
    then select the Administrator account.
  - Turn on "Trust X-Forwarded-* Proxy Headers" under
    Administration Area -> Security. The wiki sits behind Caddy, and this is
    what lets it see your visitors' real IP addresses.

This file is the only copy of the password. Delete it once you have changed it:

  rm ${CREDENTIALS_FILE}

Using your own domain name (HTTPS)
----------------------------------

  1. Create a DNS A record pointing your domain to ${public_ip}.
  2. Run:  wiki-hostname wiki.example.com

Caddy obtains a certificate from Let's Encrypt and renews it automatically.
The wiki is then served at https://wiki.example.com only.
Run "wiki-hostname --clear" to go back to plain HTTP on the IP address.

Files
-----

  ${WIKI_DIR}/compose.yaml         Docker Compose services (PostgreSQL, Wiki.js, Caddy)
  ${WIKI_DIR}/Caddyfile            Caddy reverse proxy configuration
  ${WIKI_DIR}/.env                 WIKI_HOSTNAME
  ${WIKI_DIR}/secrets/db_password  PostgreSQL password

To update Wiki.js:  cd ${WIKI_DIR} && docker compose pull && docker compose up -d
EOF
umask 022

# -> cloud-init does not wait for the Docker daemon
for _ in $(seq 60); do
  docker info > /dev/null 2>&1 && break
  sleep 2
done

# -> The first start seeds the database, creating admin@example.com with ADMIN_PASS. --wait returns
#    once the wiki answers its health check, which is after the seed.
ADMIN_PASS="$admin_password" docker compose up -d --wait --wait-timeout 600

# -> Recreate the wiki without ADMIN_PASS, which nothing reads again, so the password is not left in
#    the container's environment
docker compose up -d --wait --wait-timeout 600
