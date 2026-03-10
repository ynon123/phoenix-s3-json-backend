resource "aws_lambda_function" "post" {
  function_name    = local.post_function_name
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs20.x"
  handler          = "src/handlers/postJson.handler"
  filename         = local.lambda_zip_path
  source_code_hash = filebase64sha256(local.lambda_zip_path)
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      S3_BUCKET = aws_s3_bucket.data.bucket
      S3_PREFIX = var.s3_prefix
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy.lambda_s3
  ]
}

resource "aws_lambda_function" "get" {
  function_name    = local.get_function_name
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs20.x"
  handler          = "src/handlers/getJson.handler"
  filename         = local.lambda_zip_path
  source_code_hash = filebase64sha256(local.lambda_zip_path)
  timeout          = 15
  memory_size      = 256

  environment {
    variables = {
      S3_BUCKET = aws_s3_bucket.data.bucket
      S3_PREFIX = var.s3_prefix
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy.lambda_s3
  ]
}
