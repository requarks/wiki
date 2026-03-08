resource "google_sql_database_instance" "postgres" {
  name             = "${local.name_prefix}-postgres"
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    tier = "db-custom-1-3840"

    availability_type = "REGIONAL"

    backup_configuration {
      enabled = true
    }

    ip_configuration {
      ipv4_enabled = true
    }
  }

  deletion_protection = false
}

resource "google_sql_database" "wikijs" {
  name     = var.db_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "wikijs" {
  name     = var.db_user
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}