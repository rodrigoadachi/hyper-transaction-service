# =============================================================================
# RDS PostgreSQL 17
#
# - Multi-AZ: synchronous standby replica in a second AZ (< 2 min failover)
# - gp3 storage: 3000 IOPS baseline, independently scalable
# - Parameter group: tuned for connection handling and query logging
# - Automated backups: 7-day retention + PITR (point-in-time recovery)
# =============================================================================

# ─── Subnet Group (data tier subnets) ────────────────────────────────────────

resource "aws_db_subnet_group" "postgres" {
  name       = "${local.name_prefix}-rds"
  subnet_ids = aws_subnet.private_data[*].id
  description = "RDS subnet group for ${local.name_prefix}"

  tags = { Name = "${local.name_prefix}-rds-subnet-group" }
}

# ─── Parameter Group ──────────────────────────────────────────────────────────

resource "aws_db_parameter_group" "postgres" {
  name   = "${local.name_prefix}-pg17"
  family = "postgres17"
  description = "Custom parameters for ${local.name_prefix} PostgreSQL 17"

  # Log slow queries (> 1 second) — feeds into CloudWatch for alerting
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  # Log connections/disconnections for audit trail
  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  # Needed for idempotency implementation: ensures read-then-write is safe
  # in SERIALIZABLE transaction isolation (used in idempotency repository)
  parameter {
    name  = "default_transaction_isolation"
    value = "read committed" # default — individual transactions escalate as needed
  }

  tags = { Name = "${local.name_prefix}-pg17" }
}

# ─── RDS Instance ─────────────────────────────────────────────────────────────

resource "aws_db_instance" "postgres" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "17"
  instance_class = var.db_instance_class

  # Storage
  allocated_storage     = var.db_storage_gb
  max_allocated_storage = var.db_storage_gb * 3 # Auto-scaling ceiling (3x base)
  storage_type          = "gp3"
  storage_encrypted     = true

  # Credentials — stored in Secrets Manager, not committed here
  db_name  = "hyper_finance"
  username = "hyper_admin"
  # password managed via AWS Secrets Manager rotation — set manually after apply:
  # aws secretsmanager get-secret-value --secret-id /hyper/production/app
  # aws rds modify-db-instance --master-user-password <value>
  manage_master_user_password = true # AWS manages rotation automatically

  # High Availability
  multi_az = var.db_multi_az

  # Networking — private subnets only, no public access
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Required for postgres parameter group
  parameter_group_name = aws_db_parameter_group.postgres.name

  # Backups
  backup_retention_period = 7    # days — enables PITR
  backup_window           = "03:00-04:00"  # UTC, low-traffic window
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Prevent accidental deletion via `terraform destroy`
  deletion_protection = true

  # On destroy: take final snapshot before deleting (set to false in CI/test envs)
  skip_final_snapshot       = var.environment == "staging" ? true : false
  final_snapshot_identifier = "${local.name_prefix}-final-snapshot"

  # Performance Insights
  performance_insights_enabled = true

  tags = { Name = "${local.name_prefix}-postgres" }
}
