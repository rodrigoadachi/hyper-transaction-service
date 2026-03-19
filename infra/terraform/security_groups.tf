# =============================================================================
# Security Groups — principle of least privilege
#
# Traffic flow:
#   Internet → ALB (443/80)
#   ALB → API (3333)
#   API → RDS (5432)
#   API → Redis (6379)
# =============================================================================

# ─── ALB ──────────────────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-sg-alb"
  description = "Allow HTTPS/HTTP inbound from internet to ALB"
  vpc_id      = aws_vpc.main.id

  # HTTPS — primary traffic
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from internet"
  }

  # HTTP — redirect to HTTPS (ALB listener handles the 301)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from internet (redirect to HTTPS)"
  }

  # CodeDeploy test listener — receives test traffic during Blue/Green deployments
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "CodeDeploy test listener"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound (to ECS tasks)"
  }

  tags = { Name = "${local.name_prefix}-sg-alb" }
}

# ─── API (ECS tasks) ──────────────────────────────────────────────────────────

resource "aws_security_group" "api" {
  name        = "${local.name_prefix}-sg-api"
  description = "Allow inbound from ALB only; restrict outbound to data tier"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 3333
    to_port         = 3333
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "NestJS API port from ALB"
  }

  # Allow all outbound — ECS tasks need to reach RDS, Redis, ECR, Secrets Manager, CloudWatch
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = { Name = "${local.name_prefix}-sg-api" }
}

# ─── RDS PostgreSQL ───────────────────────────────────────────────────────────

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-sg-rds"
  description = "Allow PostgreSQL access from API tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
    description     = "PostgreSQL from API"
  }

  # No direct egress needed — RDS only responds to queries
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-sg-rds" }
}

# ─── ElastiCache Redis ────────────────────────────────────────────────────────

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-sg-redis"
  description = "Allow Redis access from API tasks only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id]
    description     = "Redis from API"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-sg-redis" }
}
