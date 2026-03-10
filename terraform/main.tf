data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  data_bucket_name   = var.data_bucket_name != "" ? var.data_bucket_name : lower("${var.name_prefix}-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}-json")
  post_function_name = var.post_function_name != "" ? var.post_function_name : "${var.name_prefix}-post-json"
  get_function_name  = var.get_function_name != "" ? var.get_function_name : "${var.name_prefix}-get-json"
  lambda_role_name   = var.lambda_role_name != "" ? var.lambda_role_name : "${var.name_prefix}-tf-lambda-role"
  api_name           = var.api_name != "" ? var.api_name : "S3 JSON Backend API"
  lambda_zip_path    = abspath("${path.root}/../.deploy/lambda.zip")
  openapi_template   = file("${path.root}/../openapi/openapi.yaml")
  openapi_body       = replace(replace(replace(local.openapi_template, "__AWS_REGION__", data.aws_region.current.name), "__POST_LAMBDA_ARN__", aws_lambda_function.post.arn), "__GET_LAMBDA_ARN__", aws_lambda_function.get.arn)
}

resource "aws_s3_bucket" "data" {
  bucket        = local.data_bucket_name
  force_destroy = var.force_destroy_bucket
}
