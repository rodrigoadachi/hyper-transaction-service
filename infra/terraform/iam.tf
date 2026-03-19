# =============================================================================
# IAM — Roles and Policies (least privilege)
#
# Roles:
#   ecs_task_execution  — Used by ECS agent to pull images, write logs, read secrets
#   ecs_task            — Used by the container at runtime (X-Ray, future integrations)
#   codedeploy          — Used by CodeDeploy for Blue/Green ECS deploys
#   github_actions      — Assumed by GitHub Actions via OIDC (no long-lived keys)
# =============================================================================

# ─── Shared Assume Role Policy for ECS ───────────────────────────────────────

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    sid     = "ECSTasksAssumeRole"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ─── ECS Task Execution Role ──────────────────────────────────────────────────
# ECS agent assumes this role to: pull ECR images, write CloudWatch logs,
# and inject secrets from Secrets Manager into container environment.

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${local.name_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow reading specific secrets — scoped to this project/environment
data "aws_iam_policy_document" "ecs_secrets_read" {
  statement {
    sid       = "ReadProjectSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:${local.aws_region}:${local.account_id}:secret:/hyper/${var.environment}/*"]
  }
}

resource "aws_iam_policy" "ecs_secrets_read" {
  name   = "${local.name_prefix}-ecs-secrets-read"
  policy = data.aws_iam_policy_document.ecs_secrets_read.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_secrets" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = aws_iam_policy.ecs_secrets_read.arn
}

# ─── ECS Task Role ────────────────────────────────────────────────────────────
# Runtime role for the container itself. Allows container code to call AWS APIs.

resource "aws_iam_role" "ecs_task" {
  name               = "${local.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

# X-Ray tracing — enables distributed traces from the NestJS app
resource "aws_iam_role_policy_attachment" "ecs_task_xray" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# ─── CodeDeploy Role ──────────────────────────────────────────────────────────

resource "aws_iam_role" "codedeploy" {
  name = "${local.name_prefix}-codedeploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CodeDeployAssumeRole"
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "codedeploy.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "codedeploy_ecs" {
  role       = aws_iam_role.codedeploy.name
  policy_arn = "arn:aws:iam::aws:policy/AWSCodeDeployRoleForECS"
}

# ─── GitHub Actions OIDC Role ─────────────────────────────────────────────────
# GitHub Actions assumes this role via OIDC federation — no static credentials.
# The OIDC provider must be registered in IAM before applying this config.
# See: https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services

data "aws_iam_openid_connect_provider" "github" {
  # This data source reads an existing OIDC provider registered in your AWS account.
  # To create it: aws iam create-open-id-connect-provider \
  #   --url https://token.actions.githubusercontent.com \
  #   --client-id-list sts.amazonaws.com \
  #   --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    sid     = "GitHubActionsOIDC"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    # Restrict to pushes on main branch only — adjust org/repo before applying
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/main"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${local.name_prefix}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
}

data "aws_iam_policy_document" "github_actions_deploy" {
  # Push images to ECR
  statement {
    sid = "ECRPush"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:BatchGetImage",
    ]
    resources = ["*"]
  }

  # Update ECS services / task definitions
  statement {
    sid = "ECSdeploy"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
      "ecs:RegisterTaskDefinition",
      "ecs:DescribeTaskDefinition",
      "ecs:RunTask",
      "ecs:DescribeTasks",
    ]
    resources = ["*"]
  }

  # Blue/Green deployments via CodeDeploy
  statement {
    sid = "CodeDeployBlueGreen"
    actions = [
      "codedeploy:CreateDeployment",
      "codedeploy:GetDeployment",
      "codedeploy:GetDeploymentConfig",
      "codedeploy:GetApplicationRevision",
      "codedeploy:RegisterApplicationRevision",
    ]
    resources = ["*"]
  }

  # Pass execution/task roles to ECS tasks
  statement {
    sid     = "PassRoleToECS"
    actions = ["iam:PassRole"]
    resources = [
      aws_iam_role.ecs_task_execution.arn,
      aws_iam_role.ecs_task.arn,
    ]
  }
}

resource "aws_iam_policy" "github_actions_deploy" {
  name   = "${local.name_prefix}-github-actions-deploy"
  policy = data.aws_iam_policy_document.github_actions_deploy.json
}

resource "aws_iam_role_policy_attachment" "github_actions_deploy" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions_deploy.arn
}
