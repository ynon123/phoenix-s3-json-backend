variable "aws_region" {
  description = "AWS region for Terraform-managed infrastructure."
  type        = string
  default     = "eu-west-1"
}

variable "aws_profile" {
  description = "Optional AWS profile name used by the provider."
  type        = string
  default     = ""
}

variable "name_prefix" {
  description = "Prefix used for Terraform-managed resource names."
  type        = string
  default     = "phoenixchallenge"
}

variable "data_bucket_name" {
  description = "Optional existing/new S3 bucket name. Leave empty to auto-generate one."
  type        = string
  default     = ""
}

variable "s3_prefix" {
  description = "Optional prefix used by the Lambda application for JSON objects."
  type        = string
  default     = ""
  nullable    = false
}

variable "post_function_name" {
  description = "Optional Lambda function name override for the POST handler."
  type        = string
  default     = ""
}

variable "get_function_name" {
  description = "Optional Lambda function name override for the GET handler."
  type        = string
  default     = ""
}

variable "lambda_role_name" {
  description = "Optional IAM role name override for the Lambda execution role."
  type        = string
  default     = ""
}

variable "api_name" {
  description = "Optional API Gateway REST API name override."
  type        = string
  default     = ""
}

variable "api_stage" {
  description = "API Gateway stage name."
  type        = string
  default     = "prod"
}

variable "force_destroy_bucket" {
  description = "Whether Terraform may destroy the bucket even if it contains objects."
  type        = bool
  default     = true
}


