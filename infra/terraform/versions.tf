terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — uncomment and configure before running `terraform init`
  # The S3 bucket and DynamoDB table must be created manually before bootstrap.
  #
  # backend "s3" {
  #   bucket         = "hyper-finance-tfstate"
  #   key            = "production/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "hyper-finance-tfstate-lock"  # prevents concurrent applies
  # }
}
