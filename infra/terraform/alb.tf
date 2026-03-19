# =============================================================================
# Application Load Balancer
#
# - HTTPS listener (443) → api_blue target group (production traffic)
# - HTTP listener  (80)  → 301 redirect to HTTPS
# - HTTP listener  (8080) → api_green target group (CodeDeploy test traffic)
#
# Two target groups (blue/green) enable zero-downtime Blue/Green deployments
# via CodeDeploy — traffic shifts from blue to green during each deployment.
# =============================================================================

# ─── ALB ──────────────────────────────────────────────────────────────────────

resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # Access logs — useful for debugging and compliance
  # Uncomment and configure an S3 bucket for production
  # access_logs {
  #   bucket  = "hyper-finance-alb-logs"
  #   prefix  = var.environment
  #   enabled = true
  # }

  tags = { Name = "${local.name_prefix}-alb" }
}

# ─── Target Groups ────────────────────────────────────────────────────────────
# Blue = currently live (stable), Green = next version (candidate)

resource "aws_lb_target_group" "api_blue" {
  name        = "${local.name_prefix}-api-blue"
  port        = 3333
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # Required for Fargate awsvpc networking

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
  }

  # Allow time for NestJS to start (module init + DB pool warmup)
  slow_start = 30

  tags = { Name = "${local.name_prefix}-api-blue" }
}

resource "aws_lb_target_group" "api_green" {
  name        = "${local.name_prefix}-api-green"
  port        = 3333
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
  }

  slow_start = 30

  tags = { Name = "${local.name_prefix}-api-green" }
}

# ─── ACM Certificate (existing — Terraform reads but does not create DNS) ─────

data "aws_acm_certificate" "api" {
  domain      = "api.${var.domain_name}"
  statuses    = ["ISSUED"]
  most_recent = true
}

# ─── Listeners ────────────────────────────────────────────────────────────────

# HTTPS :443 → blue target group (CodeDeploy manages the swap to green)
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # TLS 1.3 only
  certificate_arn   = data.aws_acm_certificate.api.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_blue.arn
  }

  # CodeDeploy manages this listener — prevent Terraform from reverting it
  lifecycle {
    ignore_changes = [default_action]
  }
}

# HTTP :80 → 301 redirect to HTTPS
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Test listener :8080 → green target group (CodeDeploy test traffic only)
resource "aws_lb_listener" "test" {
  load_balancer_arn = aws_lb.main.arn
  port              = 8080
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_green.arn
  }

  lifecycle {
    ignore_changes = [default_action]
  }
}
