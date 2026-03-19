provider "aws" {
  region = var.region

  # Default tags applied to every resource — no need to repeat in individual resources
  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "github.com/YOUR_ORG/YOUR_REPO"
    }
  }
}

# ─── Data sources ─────────────────────────────────────────────────────────────

# Current AWS account identity — used to build ARNs without hardcoding account IDs
data "aws_caller_identity" "current" {}

# Current region — used to build ARNs in jsonencode() inline policies
data "aws_region" "current" {}

# ─── Locals ───────────────────────────────────────────────────────────────────

locals {
  # Prefix used for every named resource: "hyper-finance-production"
  name_prefix = "${var.project}-${var.environment}"

  account_id = data.aws_caller_identity.current.account_id
  aws_region = data.aws_region.current.name

  # Full ECR image URIs (account.dkr.ecr.region.amazonaws.com/repo:tag)
  api_image_uri = "${local.account_id}.dkr.ecr.${local.aws_region}.amazonaws.com/${local.name_prefix}-api:${var.api_image_tag}"
  web_image_uri = "${local.account_id}.dkr.ecr.${local.aws_region}.amazonaws.com/${local.name_prefix}-web:${var.web_image_tag}"
}
