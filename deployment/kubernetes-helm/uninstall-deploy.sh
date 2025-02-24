#!/bin/bash
helm uninstall capwiki
#kubectl get pvc
# kubectl delete pvc # if capwiki pod deployment is failed due to database connection error 