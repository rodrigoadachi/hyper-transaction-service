# =============================================================================
# CloudWatch — Log Groups, Metric Filters, Alarms
#
# Observability strategy:
#   NestJS (Pino JSON) → ECS log driver → CloudWatch Logs
#     ├─ Log Insights: ad-hoc queries
#     ├─ Metric Filters: extract error rates, queue depth from JSON logs
#     └─ Alarms → SNS → PagerDuty / Slack
# =============================================================================

# ─── Log Groups ───────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name_prefix}/api"
  retention_in_days = 30 # balance cost vs debugging window

  tags = { Name = "${local.name_prefix}-logs-api" }
}

resource "aws_cloudwatch_log_group" "ecs_cluster" {
  name              = "/ecs/${local.name_prefix}/cluster"
  retention_in_days = 7

  tags = { Name = "${local.name_prefix}-logs-cluster" }
}

# ─── SNS Topic (alarm notifications) ─────────────────────────────────────────
# Subscribe PagerDuty / Slack webhook via the AWS console after apply.

resource "aws_sns_topic" "alarms" {
  name = "${local.name_prefix}-alarms"
  tags = { Name = "${local.name_prefix}-alarms" }
}

# ─── Metric Filters (extract signals from Pino JSON logs) ────────────────────

# Count HTTP 5xx errors — Pino logs include `res.statusCode` in JSON
resource "aws_cloudwatch_log_metric_filter" "api_5xx" {
  name           = "${local.name_prefix}-api-5xx"
  log_group_name = aws_cloudwatch_log_group.api.name

  # Pino-http logs structured JSON — match any response with status >= 500
  pattern = "{ $.res.statusCode >= 500 }"

  metric_transformation {
    name          = "Api5xxErrors"
    namespace     = "HyperFinance/${var.environment}"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# Count unhandled domain exceptions (INTERNAL_ERROR events)
resource "aws_cloudwatch_log_metric_filter" "api_errors" {
  name           = "${local.name_prefix}-api-errors"
  log_group_name = aws_cloudwatch_log_group.api.name

  pattern = "{ $.level = \"error\" }"

  metric_transformation {
    name          = "ApiErrorLogs"
    namespace     = "HyperFinance/${var.environment}"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# ─── CloudWatch Alarms ────────────────────────────────────────────────────────

# P1: 5xx error rate > 1% for 5 minutes — immediate action required
resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  alarm_name          = "${local.name_prefix}-api-5xx-rate"
  alarm_description   = "API 5xx error rate exceeded 1% sustained for 5 minutes (P1)"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 5
  period              = 60
  statistic           = "Sum"
  threshold           = 1

  namespace   = "HyperFinance/${var.environment}"
  metric_name = "Api5xxErrors"

  treat_missing_data = "notBreaching"

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = { Name = "${local.name_prefix}-alarm-5xx" }
}

# P2: ECS CPU utilisation > 80% — approaching scale limit
resource "aws_cloudwatch_metric_alarm" "api_cpu_high" {
  alarm_name          = "${local.name_prefix}-api-cpu-high"
  alarm_description   = "API ECS task CPU > 80% — auto-scaling should trigger (P2)"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  period              = 60
  statistic           = "Average"
  threshold           = 80

  namespace   = "AWS/ECS"
  metric_name = "CPUUtilization"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.api.name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = { Name = "${local.name_prefix}-alarm-cpu" }
}

# P2: RDS P95 write latency > 500ms — queries degrading
resource "aws_cloudwatch_metric_alarm" "rds_latency" {
  alarm_name          = "${local.name_prefix}-rds-write-latency"
  alarm_description   = "RDS write latency P95 > 500ms for 5 minutes (P2)"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 5
  period              = 60
  extended_statistic  = "p95"
  threshold           = 0.5 # seconds

  namespace   = "AWS/RDS"
  metric_name = "WriteLatency"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = { Name = "${local.name_prefix}-alarm-rds-latency" }
}

# P2: Redis cache hit rate < 80% — TTL tuning may be needed
resource "aws_cloudwatch_metric_alarm" "redis_cache_hits" {
  alarm_name          = "${local.name_prefix}-redis-cache-hit-rate-low"
  alarm_description   = "Redis cache hit rate below 80% for 15 minutes (P3)"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 15
  period              = 60
  statistic           = "Average"
  threshold           = 80

  namespace   = "AWS/ElastiCache"
  metric_name = "CacheHitRate"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis.id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = { Name = "${local.name_prefix}-alarm-redis-hit-rate" }
}

# ─── CloudWatch Dashboard ─────────────────────────────────────────────────────
# Quick-access operational dashboard — viewable in CloudWatch console.

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-operations"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0; y = 0; width = 12; height = 6
        properties = {
          title  = "API — Request Rate & 5xx Errors"
          region = local.aws_region
          metrics = [
            ["HyperFinance/${var.environment}", "Api5xxErrors", { stat = "Sum", period = 60, color = "#d62728" }],
            ["HyperFinance/${var.environment}", "ApiErrorLogs", { stat = "Sum", period = 60, color = "#ff7f0e" }],
          ]
          view    = "timeSeries"
          stacked = false
        }
      },
      {
        type   = "metric"
        x      = 12; y = 0; width = 12; height = 6
        properties = {
          title  = "ECS API — CPU & Memory"
          region = local.aws_region
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.api.name, { stat = "Average", period = 60 }],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.api.name, { stat = "Average", period = 60 }],
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        x      = 0; y = 6; width = 12; height = 6
        properties = {
          title  = "RDS — Latency & Connections"
          region = local.aws_region
          metrics = [
            ["AWS/RDS", "WriteLatency", "DBInstanceIdentifier", aws_db_instance.postgres.identifier, { stat = "p95", period = 60 }],
            ["AWS/RDS", "ReadLatency", "DBInstanceIdentifier", aws_db_instance.postgres.identifier, { stat = "p95", period = 60 }],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.postgres.identifier, { stat = "Average", period = 60 }],
          ]
          view = "timeSeries"
        }
      }
    ]
  })
}
