# =============================================================================
# ECS — Cluster, Task Definitions, Services, Auto Scaling, CodeDeploy
#
# Architecture:
#   - API service: Blue/Green deployment via CodeDeploy (zero downtime)
#   - Auto-scaling: scale API tasks on CPU utilisation (70%) or ALB request rate
#   - Migration task: launched as one-off before each deployment (see deploy.yml)
# =============================================================================

# ─── ECS Cluster ──────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled" # Detailed CPU/memory metrics per task in CloudWatch
  }

  tags = { Name = "${local.name_prefix}-cluster" }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

# ─── API Task Definition ──────────────────────────────────────────────────────
# Injects every secret via Secrets Manager (no plaintext in env vars).
# The task execution role has secretsmanager:GetSecretValue for /hyper/{env}/*.

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "awsvpc" # Required for Fargate — each task gets its own ENI
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_task_cpu
  memory                   = var.api_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = local.api_image_uri
      essential = true

      portMappings = [
        {
          containerPort = 3333
          protocol      = "tcp"
        }
      ]

      # Static environment variables (non-sensitive)
      environment = [
        { name = "PORT", value = "3333" },
        { name = "NODE_ENV", value = "production" },
      ]

      # Sensitive values injected from Secrets Manager at task start
      # Format: "secretArn:jsonKey::" — reads a specific key from a JSON secret
      secrets = [
        { name = "POSTGRES_HOST", valueFrom = "${aws_secretsmanager_secret.app.arn}:POSTGRES_HOST::" },
        { name = "POSTGRES_USER", valueFrom = "${aws_secretsmanager_secret.app.arn}:POSTGRES_USER::" },
        { name = "POSTGRES_PASSWORD", valueFrom = "${aws_secretsmanager_secret.app.arn}:POSTGRES_PASSWORD::" },
        { name = "POSTGRES_DB", valueFrom = "${aws_secretsmanager_secret.app.arn}:POSTGRES_DB::" },
        { name = "REDIS_HOST", valueFrom = "${aws_secretsmanager_secret.app.arn}:REDIS_HOST::" },
        { name = "REDIS_PASSWORD", valueFrom = "${aws_secretsmanager_secret.app.arn}:REDIS_PASSWORD::" },
        { name = "JWT_PRIVATE_KEY", valueFrom = "${aws_secretsmanager_secret.jwt.arn}:JWT_PRIVATE_KEY::" },
        { name = "JWT_PUBLIC_KEY", valueFrom = "${aws_secretsmanager_secret.jwt.arn}:JWT_PUBLIC_KEY::" },
        { name = "PEPPER", valueFrom = "${aws_secretsmanager_secret.app.arn}:PEPPER::" },
        { name = "REGISTRATION_SECRET", valueFrom = "${aws_secretsmanager_secret.app.arn}:REGISTRATION_SECRET::" },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = local.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:3333/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }

      # Stop container gracefully: NestJS handles SIGTERM for graceful shutdown
      stopTimeout = 30
    }
  ])

  tags = { Name = "${local.name_prefix}-api" }
}

# ─── API ECS Service (Blue/Green via CodeDeploy) ──────────────────────────────

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_min_capacity
  launch_type     = "FARGATE"

  deployment_controller {
    type = "CODE_DEPLOY" # Enables Blue/Green — CodeDeploy manages traffic shifting
  }

  network_configuration {
    subnets          = aws_subnet.private_app[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false # Tasks are in private subnets; internet via NAT Gateway
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api_blue.arn
    container_name   = "api"
    container_port   = 3333
  }

  lifecycle {
    # CodeDeploy updates task_definition and load_balancer — ignore Terraform drift
    ignore_changes = [task_definition, load_balancer]
  }

  depends_on = [aws_lb_listener.https]

  tags = { Name = "${local.name_prefix}-api" }
}

# ─── Auto Scaling ─────────────────────────────────────────────────────────────

resource "aws_appautoscaling_target" "api" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.api_min_capacity
  max_capacity       = var.api_max_capacity
}

# Scale out when average CPU exceeds 70%
resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${local.name_prefix}-api-cpu"
  service_namespace  = "ecs"
  scalable_dimension = "ecs:service:DesiredCount"
  resource_id        = aws_appautoscaling_target.api.resource_id
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Scale out when ALB requests per target exceed 1000/min
resource "aws_appautoscaling_policy" "api_requests" {
  name               = "${local.name_prefix}-api-requests"
  service_namespace  = "ecs"
  scalable_dimension = "ecs:service:DesiredCount"
  resource_id        = aws_appautoscaling_target.api.resource_id
  policy_type        = "TargetTrackingScaling"

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.api_blue.arn_suffix}"
    }
    target_value       = 1000.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ─── CodeDeploy Application & Deployment Group ────────────────────────────────

resource "aws_codedeploy_app" "api" {
  name             = "${local.name_prefix}-api"
  compute_platform = "ECS"
}

resource "aws_codedeploy_deployment_group" "api_production" {
  app_name               = aws_codedeploy_app.api.name
  deployment_group_name  = "production"
  service_role_arn       = aws_iam_role.codedeploy.arn

  # Canary: shift 10% traffic to green, wait 5 min, then shift remaining 90%
  deployment_config_name = "CodeDeployDefault.ECSCanary10Percent5Minutes"

  ecs_service {
    cluster_name = aws_ecs_cluster.main.name
    service_name = aws_ecs_service.api.name
  }

  deployment_style {
    deployment_option = "WITH_TRAFFIC_CONTROL"
    deployment_type   = "BLUE_GREEN"
  }

  blue_green_deployment_config {
    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT" # auto-proceed after health checks pass
    }

    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = 5 # keep blue alive briefly for emergency rollback
    }
  }

  load_balancer_info {
    target_group_pair_info {
      # Production traffic: ALB HTTPS listener
      prod_traffic_route {
        listener_arns = [aws_lb_listener.https.arn]
      }

      # Test traffic: ALB port 8080 — validates green before shifting production traffic
      test_traffic_route {
        listener_arns = [aws_lb_listener.test.arn]
      }

      target_group { name = aws_lb_target_group.api_blue.name }
      target_group { name = aws_lb_target_group.api_green.name }
    }
  }

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }
}
