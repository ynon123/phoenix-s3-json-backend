# Phoenix S3 JSON Backend

A small Node.js backend assignment that stores JSON in AWS S3 and exposes upload/download endpoints through Lambda and API Gateway.

The project supports two stages:

- Stage 1: local S3 upload/download scripts using the AWS SDK and real AWS credentials
- Stage 2: Terraform-based AWS infrastructure and deployment for S3, Lambda, IAM, API Gateway, and API verification

## Project Structure

```text
.
|- data/
|  |- sample.json
|- openapi/
|  |- openapi.yaml
|- scripts/
|  |- upload-local.js
|  |- download-local.js
|  |- package-lambda.js
|  |- verify-api.js
|- src/
|  |- config/
|  |- handlers/
|  |- services/
|  |- utils/
|- terraform/
|  |- .terraform.lock.hcl
|  |- provider.tf
|  |- variables.tf
|  |- main.tf
|  |- iam.tf
|  |- lambda.tf
|  |- api_gateway.tf
|  |- outputs.tf
|  |- terraform.tfvars.example
|- tests/
|  |- *.test.js
|- .deploy/                  # generated artifacts only
```

Key locations:

- Lambda handlers: `src/handlers/postJson.js` and `src/handlers/getJson.js`
- Canonical OpenAPI template: `openapi/openapi.yaml`
- Terraform infrastructure: `terraform/`
- Local scripts and verification: `scripts/`
- Unit tests: `tests/`

## Prerequisites

- Node.js 20 or newer
- An AWS account
- AWS credentials configured for the AWS SDK and Terraform
- Terraform installed
- AWS CLI is optional, but useful for checking credentials with `aws sts get-caller-identity`

## Environment and Configuration

Local Stage 1 scripts use `.env` automatically through `src/config/env.js`.

Project `.env` variables:

- `AWS_REGION` required
- `S3_BUCKET` required
- `S3_PREFIX` optional
- `AWS_PROFILE` optional
- `API_INVOKE_URL` optional override for `npm run verify:aws`

Example `.env`:

```env
AWS_REGION=eu-west-1
AWS_PROFILE=default
S3_BUCKET=your-stage1-bucket-name
S3_PREFIX=
# API_INVOKE_URL=            # Optional override for npm run verify:aws only.
```

Terraform deployment configuration lives in `terraform/terraform.tfvars`.
Start from `terraform/terraform.tfvars.example`.

Terraform variables:

- `aws_region` optional, defaults to `eu-west-1`
- `aws_profile` optional
- `name_prefix` optional, defaults to `phoenixchallenge`
- `data_bucket_name` optional, auto-generated if empty
- `s3_prefix` optional
- `post_function_name` optional
- `get_function_name` optional
- `lambda_role_name` optional
- `api_name` optional
- `api_stage` optional, defaults to `prod`
- `force_destroy_bucket` optional, defaults to `true`

Example `terraform/terraform.tfvars`:

```hcl
aws_region  = "eu-west-1"
aws_profile = "default"
name_prefix = "phoenixchallenge"
s3_prefix   = ""
api_stage   = "prod"
```

AWS credentials may also come from the standard AWS SDK / Terraform credential chain.

## Stage 1 - Local S3 Scripts

Stage 1 uses the real AWS SDK and real AWS credentials.

`scripts/upload-local.js`:

- reads a local JSON file
- validates JSON
- uploads it to the configured S3 bucket

`scripts/download-local.js`:

- downloads a JSON object from the configured S3 bucket
- parses it
- prints the JSON to stdout

Commands:

```bash
npm install
npm run upload:local -- data/sample.json sample.json
npm run download:local -- sample.json
```

Expected successful output:

- upload prints a line like `Uploaded JSON to s3://your-bucket/sample.json`
- download prints the JSON document in pretty JSON format

Common errors:

- missing `AWS_REGION` or `S3_BUCKET`
- invalid JSON file content
- local file not found
- S3 bucket not found
- S3 key not found
- AWS credential or IAM permission errors

## Stage 2 - Terraform Deployment

Terraform is the official infrastructure and deployment path. It creates and manages a fresh Terraform-owned stack.

It manages:

- S3 bucket for JSON data
- IAM role and policies for Lambda
- Lambda functions for POST and GET
- API Gateway REST API
- API deployment and stage
- Lambda invoke permissions for API Gateway

`scripts/package-lambda.js` prepares `.deploy/lambda.zip`, which Terraform uses for both Lambda functions. `npm run terraform:plan` and `npm run terraform:apply` already run `npm run package:lambda`, so `package:lambda` is only needed when you want to build the Lambda zip manually.

Commands:

```bash
npm run terraform:init
npm run terraform:plan
npm run terraform:apply
npm run verify:aws
```

Expected successful output:

- `terraform:apply` creates or updates the AWS infrastructure and prints Terraform outputs including the API URL
- `verify:aws` prints `POST status: 200` and `GET status: 200` plus the returned bodies

## OpenAPI and API Gateway

`openapi/openapi.yaml` is the single canonical OpenAPI template in source control.

It contains placeholders for:

- `__AWS_REGION__`
- `__POST_LAMBDA_ARN__`
- `__GET_LAMBDA_ARN__`

Terraform renders those placeholders in memory and uses the rendered body to manage API Gateway and upload the deployment artifact to S3.

`.deploy/` is used only for generated artifacts such as Lambda packaging output and an optional cached Terraform output file for `verify:aws`. Terraform state and live `terraform output` remain the source of truth.

## Tests

Run unit tests with:

```bash
npm test
```

`npm test` covers mocked unit tests for:

- S3 service upload/download behavior
- S3 error mapping for missing key and missing bucket
- POST handler success and invalid-request handling
- GET handler success, not-found, missing-key, and server-error handling
- OpenAPI template parsing and route presence

These tests do not call real AWS.

`npm run verify:aws` is the real end-to-end verification step after Terraform apply.

## IAM Permissions

Stage 1 uses your AWS credentials directly, so those credentials must allow access to the chosen S3 bucket.

Stage 2 creates a Lambda execution role with:

- CloudWatch logging permissions through `AWSLambdaBasicExecutionRole`
- S3 permissions for `ListBucket`, `GetObject`, and `PutObject`

Your Terraform runner credentials must also be able to create and update S3, IAM, Lambda, API Gateway, and Lambda permissions resources.

## Submission Notes

Reviewer flow:

1. `npm install`
2. Configure AWS credentials
3. Stage 1:
   - `npm run upload:local -- data/sample.json sample.json`
   - `npm run download:local -- sample.json`
4. Stage 2:
   - `npm run terraform:init`
   - `npm run terraform:plan`
   - `npm run terraform:apply`
   - `npm run verify:aws`

Useful optional checks:

```bash
npm test
aws sts get-caller-identity
```
