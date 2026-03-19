# =============================================================================
# AWS Secrets Manager — Application Secrets
#
# Secrets are created as placeholders. After `terraform apply`, update the
# actual values manually or via a secrets rotation Lambda:
#
#   aws secretsmanager put-secret-value \
#     --secret-id /hyper/production/app \
#     --secret-string '{"POSTGRES_HOST":"rds-endpoint.us-east-1.rds.amazonaws.com",...}'
#
# The `lifecycle { ignore_changes = [secret_string] }` block ensures
# Terraform never overwrites real secrets on re-apply.
# =============================================================================

# ─── Application Config Secret ────────────────────────────────────────────────
# Holds database credentials, Redis host, pepper, and registration secret.

resource "aws_secretsmanager_secret" "app" {
  name        = "/hyper/${var.environment}/app"
  description = "Application runtime configuration for Hyper Finance (${var.environment})"

  # 7-day recovery window before permanent deletion (prevents accidental deletes)
  recovery_window_in_days = 7

  tags = { Name = "${local.name_prefix}-secret-app" }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id

  # Placeholder values — REPLACE via AWS console or CLI before first deployment.
  # JSON keys must match exactly the env var names expected by apps/api/src/config/env.ts
  secret_string = jsonencode({
    POSTGRES_HOST       = "REPLACE_WITH_RDS_ENDPOINT"
    POSTGRES_USER       = "hyper_admin"
    POSTGRES_PASSWORD   = "REPLACE_WITH_STRONG_PASSWORD"
    POSTGRES_DB         = "hyper_finance"
    REDIS_HOST          = "REPLACE_WITH_ELASTICACHE_ENDPOINT"
    REDIS_PASSWORD      = "REPLACE_WITH_REDIS_AUTH_TOKEN"
    PEPPER              = "REPLACE_WITH_RANDOM_32_CHAR_STRING"
    REGISTRATION_SECRET = "REPLACE_WITH_RANDOM_32_CHAR_STRING"
  })

  lifecycle {
    # Never overwrite actual secrets on re-apply — only the first apply sets the placeholder
    ignore_changes = [secret_string]
  }
}

# ─── JWT Signing Keys ─────────────────────────────────────────────────────────
# ECDSA P-256 keys — private key signs tokens, public key verifies them.
# Keys are base64-encoded PEM strings (single-line, env-var safe).
#
# Generate with:
#   openssl ecparam -name prime256v1 -genkey -noout -out ec_private.pem
#   openssl ec -in ec_private.pem -pubout -out ec_public.pem
#   # Base64-encode (single line, no wrapping):
#   base64 -w0 ec_private.pem
#   base64 -w0 ec_public.pem

resource "aws_secretsmanager_secret" "jwt" {
  name        = "/hyper/${var.environment}/jwt"
  description = "JWT ECDSA P-256 signing keys for Hyper Finance (${var.environment})"

  recovery_window_in_days = 7

  tags = { Name = "${local.name_prefix}-secret-jwt" }
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id = aws_secretsmanager_secret.jwt.id

  secret_string = jsonencode({
    JWT_PRIVATE_KEY = "REPLACE_WITH_BASE64_ENCODED_ECDSA_PRIVATE_KEY"
    JWT_PUBLIC_KEY  = "REPLACE_WITH_BASE64_ENCODED_ECDSA_PUBLIC_KEY"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
