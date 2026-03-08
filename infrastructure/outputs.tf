output "cloud_run_url" {
  value = google_cloud_run_v2_service.wikijs.uri
}

output "db_instance_name" {
  value = google_sql_database_instance.postgres.name
}

output "storage_bucket" {
  value = google_storage_bucket.wikijs_assets.name
}

output "service_account_email" {
  value = google_service_account.wikijs.email
}