#!/bin/bash
#Docker version
docker -v

#K3s version
k3s --version

#Helm version
helm version

#K3s cluster Ready ?
kubectl get nodes

#K3s Cluster Info
kubectl cluster-info

#K3s cluster resources
kubectl get all -A

#Helm list : charts installed
helm list