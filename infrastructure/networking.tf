resource "google_service_account" "wikijs" {
  account_id   = "wikijs-service-account"
  display_name = "Wiki.js Cloud Run service account"
}