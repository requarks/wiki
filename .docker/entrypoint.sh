#!/bin/sh
if [ -f /run/secrets/wikijs_config ]; then
        cp /run/secrets/wikijs_config config.yml
fi

if [ -f /run/secrets/wikijs_privatekey ]; then
        cp /run/secrets/wikijs_privatekey wikijs_privatekey.pem
        chmod 400 wikijs_privatekey.pem
fi

exec node server
