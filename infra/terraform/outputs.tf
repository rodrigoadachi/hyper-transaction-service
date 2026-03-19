# ─── Networking ───────────────────────────────────────────────────────────────

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer — point your Route53 alias here"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Hosted Zone ID of the ALB — required for Route53 alias records"
  value       = aws_lb.main.zone_id
}

# ─── Container Registry ───────────────────────────────────────────────────────

output "ecr_api_repository_url" {
  description = "ECR repository URL for the API image"
  value       = aws_ecr_repository.api.repository_url
}

output "ecr_web_repository_url" {
  description = "ECR repository URL for the Web image"
  value       = aws_ecr_repository.web.repository_url
}

# ─── ECS ──────────────────────────────────────────────────────────────────────

output "ecs_cluster_name" {
  description = "ECS cluster name — used in GitHub Actions deploy steps"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS API service name"
  value       = aws_ecs_service.api.name
}

# ─── Database ─────────────────────────────────────────────────────────────────

output "rds_endpoint" {
  description = "RDS PostgreSQL writer endpoint — store in Secrets Manager, never in env vars"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "rds_port" {
  description = "RDS PostgreSQL port"
  value       = aws_db_instance.postgres.port
}

# ─── Cache ────────────────────────────────────────────────────────────────────

output "redis_configuration_endpoint" {
  description = "ElastiCache Redis Cluster Mode configuration endpoint"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint_address
  sensitive   = true
}

# ─── IAM ──────────────────────────────────────────────────────────────────────

output "github_actions_role_arn" {
  description = "IAM role ARN to set as AWS_DEPLOY_ROLE_ARN in GitHub Actions variables"
  value       = aws_iam_role.github_actions.arn
}

output "ecs_task_role_arn" {
  description = "ECS task role ARN (runtime permissions for the container)"
  value       = aws_iam_role.ecs_task.arn
}

# ─── Secrets Manager ──────────────────────────────────────────────────────────

output "secrets_app_arn" {
  description = "Secrets Manager ARN for the application config secret — update values after apply"
  value       = aws_secretsmanager_secret.app.arn
}

output "secrets_jwt_arn" {
  description = "Secrets Manager ARN for the JWT signing keys secret — update values after apply"
  value       = aws_secretsmanager_secret.jwt.arn
}

# ─── CodeDeploy ───────────────────────────────────────────────────────────────

output "codedeploy_app_name" {
  description = "CodeDeploy application name — used in GitHub Actions deploy step"
  value       = aws_codedeploy_app.api.name
}
