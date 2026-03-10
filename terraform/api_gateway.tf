resource "aws_s3_object" "openapi" {
  bucket       = aws_s3_bucket.data.bucket
  key          = "openapi/openapi.generated.yaml"
  content      = local.openapi_body
  content_type = "application/yaml"
}

resource "aws_api_gateway_rest_api" "this" {
  name              = local.api_name
  body              = local.openapi_body
  put_rest_api_mode = "overwrite"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_lambda_permission" "post_api" {
  statement_id  = "AllowApiGatewayInvokePost"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.post.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.this.execution_arn}/*/*/json/*"
}

resource "aws_lambda_permission" "get_api" {
  statement_id  = "AllowApiGatewayInvokeGet"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.this.execution_arn}/*/*/json/*"
}

resource "aws_api_gateway_deployment" "this" {
  rest_api_id = aws_api_gateway_rest_api.this.id

  triggers = {
    redeployment = sha1(join(",", [
      local.openapi_body,
      aws_lambda_function.post.source_code_hash,
      aws_lambda_function.get.source_code_hash
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_s3_object.openapi,
    aws_lambda_permission.post_api,
    aws_lambda_permission.get_api
  ]
}

resource "aws_api_gateway_stage" "this" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  deployment_id = aws_api_gateway_deployment.this.id
  stage_name    = var.api_stage
}
