#!/bin/bash

sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https

sudo ufw --force enable

cat /dev/null > /var/log/ufw.log
