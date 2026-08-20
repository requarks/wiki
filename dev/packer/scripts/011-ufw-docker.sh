#!/bin/bash

ufw limit ssh
ufw allow http
ufw allow https

ufw --force enable

cat /dev/null > /var/log/ufw.log
