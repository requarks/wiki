resource "google_storage_bucket" "wikijs_assets" {
  name                        = "${var.project_id}-${local.name_prefix}-assets"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true
}