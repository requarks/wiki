#!/bin/bash
#
# DigitalOcean's base images come with their agents installed, which a Marketplace image must not
# carry (99-img-check.sh fails on /opt/digitalocean). Removed only if present, so that a base image
# that stops shipping one does not break the build.

set -euo pipefail

for pkg in droplet-agent do-agent; do
  if dpkg-query -W -f='${Status}' "$pkg" 2> /dev/null | grep -q 'install ok installed'; then
    apt-get -qqy purge "$pkg"
  fi
done

apt-get -qqy autoremove --purge
rm -rf /opt/digitalocean
