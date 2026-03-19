# =============================================================================
# ElastiCache Redis 7 — Cluster Mode Enabled
#
# Used for:
#   1. Idempotency distributed lock (SET NX PX) — prevents duplicate processing
#   2. BullMQ job queues (transaction processing worker)
#
# Cluster Mode (3 shards × 1 replica) provides:
#   - Horizontal write scaling (each shard owns a key range)
#   - Read scaling via replicas in separate AZs
#   - Automatic failover per shard (< 30 seconds)
# =============================================================================

# ─── Subnet Group ──────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis"
  subnet_ids = aws_subnet.private_data[*].id
  description = "ElastiCache subnet group for ${local.name_prefix}"
}

# ─── Parameter Group ──────────────────────────────────────────────────────────

resource "aws_elasticache_parameter_group" "redis" {
  name   = "${local.name_prefix}-redis7"
  family = "redis7"
  description = "Custom parameters for ${local.name_prefix} Redis 7"

  # Persist queue jobs across restarts — BullMQ depends on durability
  parameter {
    name  = "appendonly"
    value = "yes"
  }

  # fsync every second — balances durability vs performance
  parameter {
    name  = "appendfsync"
    value = "everysec"
  }

  # Disable dangerous commands in production (FLUSHALL, FLUSHDB, DEBUG)
  # ElastiCache does not support RENAME-COMMAND directly — use ACL instead
}

# ─── Replication Group (Cluster Mode) ────────────────────────────────────────

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "Redis 7 Cluster Mode for ${local.name_prefix}"

  node_type = var.cache_node_type
  port      = 6379

  # Cluster Mode configuration
  num_node_groups         = var.cache_num_shards          # number of shards
  replicas_per_node_group = var.cache_replicas_per_shard  # replicas per shard

  # Engine
  engine_version       = "7.1"
  parameter_group_name = aws_elasticache_parameter_group.redis.name

  # Networking
  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true # forces TLS — ioredis: tls: {} in app config
  auth_token                 = null  # Token set via Secrets Manager — add if auth_token_update_strategy is used

  # Maintenance & backup
  maintenance_window       = "tue:05:00-tue:06:00"
  snapshot_window          = "04:00-05:00"
  snapshot_retention_limit = 3 # days

  # Failover
  automatic_failover_enabled = true
  multi_az_enabled           = true

  # Prevent accidental deletion
  apply_immediately = false

  tags = { Name = "${local.name_prefix}-redis" }
}
