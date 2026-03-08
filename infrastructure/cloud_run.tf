resource "google_cloud_run_v2_service" "wikijs" {
  name     = "${local.name_prefix}-service"
  location = var.region

  template {

    service_account = google_service_account.wikijs.email

    scaling {
      min_instance_count = 1
      max_instance_count = 5
    }

    containers {
      image = var.container_image

      ports {
        container_port = 3000
      }

      env {
        name  = "DB_TYPE"
        value = "postgres"
      }

      env {
        name  = "DB_HOST"
        value = google_sql_database_instance.postgres.public_ip_address
      }

      env {
        name  = "DB_PORT"
        value = "5432"
      }

      env {
        name  = "DB_NAME"
        value = var.db_name
      }

      env {
        name  = "DB_USER"
        value = var.db_user
      }

      env {
        name = "DB_PASS"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_password.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  ingress = "INGRESS_TRAFFIC_ALL"
}


resource "google_cloud_run_service_iam_member" "public_access" {
  location = google_cloud_run_v2_service.wikijs.location
  service  = google_cloud_run_v2_service.wikijs.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}