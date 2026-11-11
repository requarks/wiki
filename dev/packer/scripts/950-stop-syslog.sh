#!/bin/bash
#
# 900-cleanup.sh empties /var/log, then spends minutes zero-filling the disk, during which the firewall
# logs every port scan that reaches the droplet's public address (kern.log) and sshd every stray
# connection (auth.log). Those would ship in the image, and 99-img-check.sh warns about them.
#
# So rsyslog is stopped for what is left of the build, and its files emptied once more. It is still
# enabled, so it starts again on the droplet's first boot. Its socket is stopped too, since a message
# arriving on it would otherwise start the service again. The journal is left alone: journald has its
# files open, and truncating them under it corrupts them.

set -euo pipefail

systemctl stop syslog.socket rsyslog.service

find /var/log -path /var/log/journal -prune -o -type f -mtime -1 -exec truncate -s 0 {} +
