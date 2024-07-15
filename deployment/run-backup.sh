#!/bin/bash

SERVICE=wiki SERVICE_DB=wiki-db DB_USER=postgres DATABASE=wiki ./backup.sh --dev1

SERVICE=keycloak SERVICE_DB=keycloak-db DB_USER=postgres DATABASE=keycloak ./backup.sh --dev1
