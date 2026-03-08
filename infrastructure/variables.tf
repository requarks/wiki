variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "region" {
  description = "Deployment region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "db_name" {
  description = "Wiki.js database name"
  type        = string
  default     = "wikijs"
}

variable "db_user" {
  description = "Database username"
  type        = string
  default     = "wikijs"
}

variable "container_image" {
  description = "Wiki.js container image"
  type        = string
  default     = "ghcr.io/requarks/wiki:2"
}