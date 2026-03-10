output "data_bucket_name" {
  description = "Name of the S3 bucket used for JSON data and generated OpenAPI upload."
  value       = aws_s3_bucket.data.bucket
}

output "post_lambda_function_name" {
  description = "Lambda function name for the POST handler."
  value       = aws_lambda_function.post.function_name
}

output "get_lambda_function_name" {
  description = "Lambda function name for the GET handler."
  value       = aws_lambda_function.get.function_name
}

output "api_id" {
  description = "API Gateway REST API ID."
  value       = aws_api_gateway_rest_api.this.id
}

output "api_invoke_url" {
  description = "Base invoke URL for the deployed API Gateway stage."
  value       = "https://${aws_api_gateway_rest_api.this.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_stage.this.stage_name}"
}

output "openapi_s3_uri" {
  description = "S3 URI of the generated OpenAPI document uploaded during deploy."
  value       = "s3://${aws_s3_bucket.data.bucket}/${aws_s3_object.openapi.key}"
}
