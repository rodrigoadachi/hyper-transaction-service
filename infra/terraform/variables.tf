# ─── Core ─────────────────────────────────────────────────────────────────────

variable "region" {
  description = "AWS region to deploy all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment — used as name suffix and for environment-specific config"
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "project" {
  description = "Project name — used as prefix for all AWS resource names"
  type        = string
  default     = "hyper-finance"
}

variable "domain_name" {
  description = "Base domain name (e.g. 'hyper.com'). Used to look up Route53 hosted zone and ACM cert."
  type        = string
}

# ─── Images ───────────────────────────────────────────────────────────────────

variable "api_image_tag" {
  description = "Docker image tag for the API container (typically the Git SHA from CI)"
  type        = string
  default     = "latest"
}

variable "web_image_tag" {
  description = "Docker image tag for the Web container (typically the Git SHA from CI)"
  type        = string
  default     = "latest"
}

# ─── ECS / Compute ────────────────────────────────────────────────────────────

variable "api_task_cpu" {
  description = "ECS task CPU units for the API (256 | 512 | 1024 | 2048 | 4096)"
  type        = number
  default     = 512
}

variable "api_task_memory" {
  description = "ECS task memory for the API in MiB (must be valid for the chosen CPU)"
  type        = number
  default     = 1024
}

variable "api_min_capacity" {
  description = "Minimum number of running API task replicas"
  type        = number
  default     = 2
}

variable "api_max_capacity" {
  description = "Maximum number of running API task replicas (auto-scaling ceiling)"
  type        = number
  default     = 20
}

# ─── Database ─────────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS PostgreSQL instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "db_storage_gb" {
  description = "RDS allocated storage in GiB (gp3)"
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = "Enable Multi-AZ standby for RDS (recommended for production)"
  type        = bool
  default     = true
}

# ─── Cache ────────────────────────────────────────────────────────────────────

variable "cache_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r6g.large"
}

variable "cache_num_shards" {
  description = "Number of Redis shards (node groups) in Cluster Mode"
  type        = number
  default     = 3
}

variable "cache_replicas_per_shard" {
  description = "Number of read replicas per Redis shard"
  type        = number
  default     = 1
}
