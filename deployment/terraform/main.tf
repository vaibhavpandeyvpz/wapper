terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

# Set the variable values in *.tfvars file
# or using CLI option e.g., -var="do_token=..."
variable "application" {
  default = "wapper"
}
variable "db_name" {
  default = "wapper"
}
variable "db_user" {
  default = "wapper"
}
variable "domain_name" {
  default = "example.com"
}
variable "do_token" {}
variable "do_region" {
  default = "blr1"
}

locals {
  db          = {
    size    = "db-s-1vcpu-1gb"
  }
  mdb         = {
    size    = "db-s-1vcpu-1gb"
  }
  server      = {
    image   = "ubuntu-22-04-x64"
    size    = "s-2vcpu-4gb"
  }
}

# Configure the provider(s)
provider "digitalocean" {
  token = var.do_token
}

# Get all SSH keys
data "digitalocean_ssh_keys" "keys" {
  sort {
    key       = "name"
    direction = "asc"
  }
}

# Get matching domain
data "digitalocean_domains" "domains" {
  filter {
    key      = "name"
    values   = [var.domain_name]
  }
}

# Create a new project
resource "digitalocean_project" "default" {
  name = var.application
}

# Create a MongoDB cluster
resource "digitalocean_database_cluster" "mongo_server" {
  name       = "${var.application}-db"
  engine     = "mongodb"
  version    = "6"
  size       = local.db.size
  region     = var.do_region
  node_count = 1
}

resource "digitalocean_database_user" "mongo_user" {
  cluster_id = digitalocean_database_cluster.mongo_server.id
  name       = var.db_user
}

resource "digitalocean_project_resources" "mongo_server" {
  project     = digitalocean_project.default.id
  resources   = [
    digitalocean_database_cluster.mongo_server.urn,
  ]
}

# Create Redis cluster
resource "digitalocean_database_cluster" "redis_server" {
  name       = "${var.application}-mdb"
  engine     = "redis"
  version    = "7"
  size       = local.mdb.size
  region     = var.do_region
  node_count = 1
}

resource "digitalocean_database_redis_config" "redis_config" {
  cluster_id          = digitalocean_database_cluster.redis_server.id
  maxmemory_policy    = "allkeys-lru"
  ssl                 = true
}

resource "digitalocean_project_resources" "redis_server" {
  project     = digitalocean_project.default.id
  resources   = [
    digitalocean_database_cluster.redis_server.urn,
  ]
}

# Create "server" droplet
resource "digitalocean_droplet" "server" {
  image       = local.server.image
  name        = var.application
  region      = var.do_region
  size        = local.server.size
  ipv6        = true
  ssh_keys    = data.digitalocean_ssh_keys.keys.ssh_keys[*].id
}

resource "digitalocean_reserved_ip" "server_ip" {
  droplet_id = digitalocean_droplet.server.id
  region     = var.do_region
}

resource "digitalocean_database_firewall" "mongo_firewall" {
  cluster_id = digitalocean_database_cluster.mongo_server.id

  rule {
    type  = "droplet"
    value = digitalocean_droplet.server.id
  }
}

resource "digitalocean_database_firewall" "redis_firewall" {
  cluster_id = digitalocean_database_cluster.redis_server.id

  rule {
    type  = "droplet"
    value = digitalocean_droplet.server.id
  }
}

resource "digitalocean_project_resources" "server" {
  project     = digitalocean_project.default.id
  resources   = [
    digitalocean_droplet.server.urn,
  ]
}

# Create A record
resource "digitalocean_record" "wapi" {
  domain = data.digitalocean_domains.domains.domains[0].name
  type   = "A"
  name   = "wapi"
  value  = digitalocean_reserved_ip.server_ip.ip_address
}

# Save values to local files
resource "local_file" "ansible_inventory" {
  content     = templatefile("inventory.tmpl", {
    server  = { ipv4: digitalocean_reserved_ip.server_ip.ip_address },
  })
  filename    = "${path.module}/../inventory.ini"
}

resource "local_file" "ansible_variables" {
  content     = templatefile("variables.tmpl", {
    mongo = {
      host      = digitalocean_database_cluster.mongo_server.private_host
      port      = digitalocean_database_cluster.mongo_server.port
      user      = digitalocean_database_user.mongo_user.name
      password  = digitalocean_database_user.mongo_user.password
    }
    redis = {
      host = digitalocean_database_cluster.redis_server.private_host
      port = digitalocean_database_cluster.redis_server.port
      password = digitalocean_database_cluster.redis_server.password
    }
  })
  filename    = "${path.module}/../variables.tf.yml"
}

# Outputs
output "db_server" {
  value = "${digitalocean_database_cluster.mongo_server.private_host}:${digitalocean_database_cluster.mongo_server.port}"
}

output "db_username" {
  value = digitalocean_database_user.mongo_user.name
}

output "db_password" {
  value = digitalocean_database_user.mongo_user.password
  sensitive = true
}

output "redis_server" {
  value = "${digitalocean_database_cluster.redis_server.private_host}:${digitalocean_database_cluster.redis_server.port}"
}

output "redis_password" {
  value = digitalocean_database_cluster.redis_server.password
  sensitive = true
}

output "server_fqdn" {
  value = digitalocean_record.wapi.fqdn
}

output "server_ipv4" {
  value = digitalocean_reserved_ip.server_ip.ip_address
}
