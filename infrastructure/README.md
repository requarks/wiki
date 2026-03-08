# Wiki.js Deployment on GCP using Terraform

## Overview

This repository contains Infrastructure as Code (Terraform) for deploying Wiki.js on Google Cloud.

The goal of this implementation is to provide a simple, secure, and scalable deployment using managed GCP services.

Main components:

- Cloud Run for running the Wiki.js container
- Cloud SQL (PostgreSQL) as the application database
- Cloud Storage for assets and file storage
- Secret Manager for database credentials
- Cloud Logging and Monitoring for observability

## Architecture

The system is built using managed services to reduce operational overhead.

Users access the Wiki.js application through Cloud Run, which runs the containerized service.

The application connects to a PostgreSQL database hosted on Cloud SQL.

Sensitive data such as database credentials are stored in Secret Manager.

Logs and metrics are automatically collected using Cloud Logging and Cloud Monitoring.

## Security Considerations

- Database credentials are stored in Secret Manager
- Cloud SQL is managed by GCP with automated backups
- Service accounts are used instead of static credentials
- Secrets are injected into the container securely

## Scalability

Cloud Run automatically scales the number of instances based on incoming traffic.

The database tier can be vertically scaled if needed.

Cloud Storage provides virtually unlimited storage capacity.

## Observability

Logs from the application are automatically collected in Cloud Logging.

Metrics from Cloud Run and Cloud SQL are available in Cloud Monitoring and can be used to configure alerts.

## Prerequisites

- Terraform >= 1.5
- gcloud CLI installed
- GCP project with billing enabled

Authenticate with:
gcloud auth application-default login

## Deployment

Initialize Terraform:
terraform init

Validate configuration:
terraform validate

Preview infrastructure changes:
terraform plan -var-file="terraform.tfvars"

Apply infrastructure:
terraform apply -var-file="terraform.tfvars"

## Destroy
To remove all resources:
terraform destroy -var-file="terraform.tfvars"

## Notes
This solution focuses on simplicity and managed services to reduce operational complexity.
Future improvements could include:
- Global Load Balancer
- Cloud Armor for additional security
- Private networking between Cloud Run and Cloud SQL
- Alert policies in Cloud Monitoring