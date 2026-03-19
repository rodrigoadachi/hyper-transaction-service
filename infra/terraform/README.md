# Terraform — Hyper Finance AWS Infrastructure

> Infrastructure as Code for the Hyper Finance production environment.
> All resources follow the architecture described in [docs/AWS-DEPLOY.md](../../docs/AWS-DEPLOY.md).

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Terraform | >= 1.9 | [developer.hashicorp.com/terraform](https://developer.hashicorp.com/terraform/install) |
| AWS CLI | >= 2.x | [aws.amazon.com/cli](https://aws.amazon.com/cli/) |
| AWS credentials | — | `aws configure` or IAM role |

---

## Files

| File | Description |
|------|-------------|
| `versions.tf` | Provider + Terraform version constraints; S3 backend config (commented) |
| `variables.tf` | All input variables with descriptions and defaults |
| `main.tf` | Provider configuration, data sources, local values |
| `outputs.tf` | Resource identifiers exported after apply (some `sensitive = true`) |
| `vpc.tf` | VPC, 3-tier subnets, NAT Gateway, route tables |
| `security_groups.tf` | Least-privilege SGs: ALB → API → RDS/Redis |
| `alb.tf` | Application Load Balancer, blue/green target groups, listeners |
| `ecr.tf` | ECR repositories (api, web) with lifecycle policies |
| `iam.tf` | ECS execution/task roles, CodeDeploy role, GitHub Actions OIDC role |
| `ecs.tf` | ECS cluster, task definitions, service, auto-scaling, CodeDeploy |
| `rds.tf` | RDS PostgreSQL 17 Multi-AZ, parameter group, automated backups |
| `elasticache.tf` | ElastiCache Redis 7 Cluster Mode (3 shards × 1 replica) |
| `secrets.tf` | Secrets Manager resources (placeholder values — update before deploy) |
| `cloudwatch.tf` | Log groups, metric filters, alarms, operational dashboard |

---

## First-time Setup

### 1. Create the Terraform state backend

Before running `terraform init`, create the S3 bucket and DynamoDB table for remote state:

```bash
# Create S3 bucket for state storage (versioning + encryption)
aws s3api create-bucket \
  --bucket hyper-finance-tfstate \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket hyper-finance-tfstate \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket hyper-finance-tfstate \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name hyper-finance-tfstate-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

Then uncomment the `backend "s3"` block in `versions.tf` and set the correct values.

### 2. Register GitHub OIDC provider in AWS (one-time)

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

### 3. Update `iam.tf` with your GitHub org/repo

In `iam.tf`, replace the placeholder in `github_actions_assume`:

```hcl
values = ["repo:YOUR_ORG/YOUR_REPO:ref:refs/heads/main"]
```

---

## Deploy

```bash
cd infra/terraform

# 1. Initialise providers and backend
terraform init

# 2. Validate configuration (catches syntax errors)
terraform validate

# 3. Preview the execution plan
terraform plan \
  -var="environment=production" \
  -var="domain_name=hyper.com" \
  -out=tfplan

# 4. Apply (creates all resources — ~5-10 minutes first time)
terraform apply tfplan
```

---

## Post-Apply: Set Real Secret Values

After the first apply, Terraform creates Secrets Manager resources with **placeholder** values.
Update them before deploying the application:

```bash
# Application config (database, redis, pepper)
aws secretsmanager put-secret-value \
  --secret-id /hyper/production/app \
  --secret-string '{
    "POSTGRES_HOST": "your-rds-endpoint.rds.amazonaws.com",
    "POSTGRES_USER": "hyper_admin",
    "POSTGRES_PASSWORD": "your-strong-password",
    "POSTGRES_DB": "hyper_finance",
    "REDIS_HOST": "your-elasticache-config-endpoint",
    "REDIS_PASSWORD": "your-redis-auth-token",
    "PEPPER": "your-32-char-random-string",
    "REGISTRATION_SECRET": "your-32-char-random-string"
  }'

# JWT signing keys (ECDSA P-256, base64-encoded PEM)
aws secretsmanager put-secret-value \
  --secret-id /hyper/production/jwt \
  --secret-string '{
    "JWT_PRIVATE_KEY": "base64-encoded-private-key",
    "JWT_PUBLIC_KEY": "base64-encoded-public-key"
  }'
```

---

## GitHub Actions Variables

After apply, set these in your GitHub repository (Settings → Secrets and variables → Actions):

**Variables (non-sensitive):**

| Name | Value (from `terraform output`) |
|------|---------------------------------|
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCOUNT_ID` | your AWS account ID |
| `AWS_DEPLOY_ROLE_ARN` | `terraform output github_actions_role_arn` |
| `BASE_DOMAIN` | `hyper.com` |
| `PRIVATE_SUBNET_IDS` | comma-separated private subnet IDs |
| `API_SECURITY_GROUP_ID` | `terraform output` from security_groups |

**Secrets:**

| Name | Description |
|------|-------------|
| `CI_JWT_PRIVATE_KEY` | ECDSA private key (base64) — only for CI test env |
| `CI_JWT_PUBLIC_KEY` | ECDSA public key (base64) — only for CI test env |
| `CI_PEPPER` | Min 32-char random string for CI |
| `CI_REGISTRATION_SECRET` | Min 32-char random string for CI |
| `STAGING_SMOKE_TEST_TOKEN` | Valid JWT for smoke test requests |

---

## Teardown

```bash
# Staging: destroy all resources
terraform destroy -var="environment=staging" -var="domain_name=hyper.com"

# Production: deletion_protection on RDS prevents accidental destroy.
# Disable it first if intentional:
terraform apply -var="environment=production" \
  -var="domain_name=hyper.com" \
  -target=aws_db_instance.postgres \
  -var="db_deletion_protection=false"
terraform destroy -var="environment=production" -var="domain_name=hyper.com"
```

---

## Cost Reference (us-east-1, production)

| Resource | Config | $/month (approx) |
|----------|--------|-----------------|
| ECS Fargate API | 2-20 tasks × 0.5vCPU/1GB | $30–$150 |
| RDS PostgreSQL 17 | db.r6g.large Multi-AZ | ~$280 |
| ElastiCache Redis 7 | cache.r6g.large × 3 shards | ~$200 |
| NAT Gateway | Single AZ | ~$35 |
| ALB | + listeners | ~$20 |
| CloudWatch | Logs + metrics | ~$20–$80 |
| **Total** | | **~$585–$765/month** |
