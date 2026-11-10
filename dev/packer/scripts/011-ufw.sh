#!/bin/bash
#
# Firewall: SSH, HTTP and HTTPS in, everything else refused.
#
# Ports Docker publishes bypass UFW (Docker writes its own iptables rules), so what is reachable from
# outside is also bounded by compose.yaml, where only Caddy publishes anything, on 80 and 443.

set -euo pipefail

apt-get -qqy install ufw

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# HTTP/3
ufw allow 443/udp

ufw --force enable
ufw status verbose

cat /dev/null > /var/log/ufw.log
