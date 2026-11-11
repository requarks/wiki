packer {
  required_plugins {
    digitalocean = {
      version = ">= 1.4.2"
      source  = "github.com/digitalocean/digitalocean"
    }
  }
}

variable "do_api_token" {
  type      = string
  default   = env("DIGITALOCEAN_API_TOKEN")
  sensitive = true
}

variable "application_name" {
  type    = string
  default = "Wiki.js"
}

variable "application_version" {
  type    = string
  default = env("WIKI_APP_VERSION")
}

locals {
  timestamp  = regex_replace(timestamp(), "[- TZ:]", "")
  image_name = "wikijs-snapshot-${local.timestamp}"

  apt_build_conf = "/etc/apt/apt.conf.d/99-packer-build"

  apt_env = [
    "DEBIAN_FRONTEND=noninteractive",
    "LC_ALL=C",
    "LANG=en_US.UTF-8",
    "LC_CTYPE=en_US.UTF-8"
  ]
}

source "digitalocean" "wikijs" {
  api_token     = var.do_api_token
  image         = "ubuntu-26-04-x64"
  region        = "nyc1"
  size          = "s-1vcpu-1gb"
  ssh_username  = "root"
  snapshot_name = local.image_name
}

build {
  sources = ["source.digitalocean.wikijs"]

  provisioner "shell" {
    inline = ["cloud-init status --wait"]
  }

  # Latest OS updates
  #
  # The Ubuntu archives, security.ubuntu.com especially, drop connections from time to time, and one
  # failed download fails the whole build. Every apt call in it, the vendored 900-cleanup.sh and
  # 999-img-check.sh included, therefore retries more patiently than apt's default 3 attempts, with
  # apt's own exponential backoff between them. Removed again at the end, so the image ships stock.
  provisioner "shell" {
    environment_vars = local.apt_env
    inline = [
      "echo 'Acquire::Retries \"10\";' > ${local.apt_build_conf}",
      "echo 'Acquire::http::Timeout \"30\";' >> ${local.apt_build_conf}",
      "echo 'Acquire::https::Timeout \"30\";' >> ${local.apt_build_conf}",
      "apt-get -qqy update",
      "apt-get -qqy -o Dpkg::Options::='--force-confdef' -o Dpkg::Options::='--force-confold' full-upgrade",
      "apt-get -qqy -o Dpkg::Options::='--force-confdef' -o Dpkg::Options::='--force-confold' install ca-certificates curl openssl",
      "apt-get -qqy autoremove",
      "apt-get -qqy clean"
    ]
  }

  # DigitalOcean's agents out, Docker + Compose in, then the firewall
  provisioner "shell" {
    environment_vars = local.apt_env
    scripts = [
      "${path.root}/scripts/009-remove-droplet-agent.sh",
      "${path.root}/scripts/010-docker.sh",
      "${path.root}/scripts/011-ufw.sh"
    ]
  }

  provisioner "shell" {
    inline = ["mkdir -p /root/wiki /var/lib/cloud/scripts/per-instance"]
  }

  # compose.yaml and Caddyfile
  provisioner "file" {
    source      = "${path.root}/files/wiki/"
    destination = "/root/wiki"
  }

  provisioner "file" {
    source      = "${path.root}/files/wiki-hostname"
    destination = "/usr/local/bin/wiki-hostname"
  }

  provisioner "file" {
    source      = "${path.root}/scripts/001-onboot.sh"
    destination = "/var/lib/cloud/scripts/per-instance/001-onboot.sh"
  }

  provisioner "file" {
    source      = "${path.root}/scripts/099-one-click"
    destination = "/etc/update-motd.d/099-one-click"
  }

  provisioner "shell" {
    environment_vars = concat(local.apt_env, [
      "application_name=${var.application_name}",
      "application_version=${var.application_version}"
    ])
    scripts = [
      "${path.root}/scripts/012-wiki.sh",
      "${path.root}/scripts/020-application-tag.sh",
      "${path.root}/scripts/890-force-ssh-logout.sh",
      "${path.root}/scripts/900-cleanup.sh",
      "${path.root}/scripts/950-stop-syslog.sh",
      "${path.root}/scripts/999-img-check.sh"
    ]
  }

  provisioner "shell" {
    inline = ["rm -f ${local.apt_build_conf}"]
  }
}
