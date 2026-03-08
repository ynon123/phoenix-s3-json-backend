# Phoenix S3 JSON Backend

## Project Overview

This project is a small Node.js backend assignment that works with JSON files in AWS S3 and includes OpenAPI-based deployment to AWS.

It has two parts:

- Stage 1: local scripts that upload JSON to S3 and download JSON from S3 using the AWS SDK
- Stage 2: AWS deployment of Lambda handlers and API Gateway using an OpenAPI template

## Project Structure

```text
.
|- openapi/
|  |- openapi.yaml
|- scripts/
|  |- upload-local.js
|  |- download-local.js
|  |- deploy-aws.js
|  |- verify-api.js
|- src/
|  |- config/
|  |- handlers/
|  |- services/
|  |- utils/
|- data/
|  |- sample.json
|- tests/
|  |- *.test.js
|- .deploy/                  # generated during deploy
|  |- openapi.generated.yaml
|  |- aws-deploy-output.json
```

Key locations:

- Lambda handlers: `src/handlers/postJson.js` and `src/handlers/getJson.js`
- Local and deployment scripts: `scripts/`
- OpenAPI template: `openapi/openapi.yaml`
- Unit tests: `tests/`
- Sample payload for Stage 1: `data/sample.json`

## Prerequisites

- Node.js 20 or newer
- An AWS account
- AWS credentials configured for the AWS SDK
- AWS CLI installed is optional, but useful for checking credentials with `aws sts get-caller-identity`

## Environment Variables

Local development automatically loads `.env` through `src/config/env.js`. Production-style execution still reads from `process.env`.

Project variables for Stage 1 local execution:

- `AWS_REGION` required
- `S3_BUCKET` required
- `S3_PREFIX` optional
- `AWS_PROFILE` optional

Project variables for Stage 2 deploy:

- `AWS_REGION` optional, defaults to `us-east-1`
- `S3_BUCKET` optional, auto-generated if empty
- `S3_PREFIX` optional
- `AWS_PROFILE` optional
- `DEPLOY_PREFIX` optional
- `POST_FUNCTION_NAME` optional
- `GET_FUNCTION_NAME` optional
- `LAMBDA_ROLE_NAME` optional
- `API_NAME` optional
- `API_STAGE` optional
- `DEPLOY_S3_BUCKET` optional
- `LAMBDA_ROLE_ARN` optional
- `REST_API_ID` optional, forces deploy to update a specific existing API Gateway REST API

Variable used by Stage 2 verification:

- `API_INVOKE_URL` optional, overrides the URL read from `.deploy/aws-deploy-output.json`

Example `.env`:

```env
AWS_REGION=us-east-1
AWS_PROFILE=default
S3_BUCKET=
S3_PREFIX=optional/prefix
DEPLOY_PREFIX=phoenixchallenge
API_NAME=phoenixchallenge-api
API_STAGE=prod
POST_FUNCTION_NAME=phoenixchallenge-post-json
GET_FUNCTION_NAME=phoenixchallenge-get-json
LAMBDA_ROLE_NAME=phoenixchallenge-lambda-role
# DEPLOY_S3_BUCKET=
# LAMBDA_ROLE_ARN=
# REST_API_ID=
# API_INVOKE_URL=
```

AWS credentials can also be provided through the standard AWS SDK credential chain, for example `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_SESSION_TOKEN`.

## Stage 1 - Local S3 Scripts

Stage 1 uses the real AWS SDK and your real AWS credentials. The scripts do not mock AWS.

`scripts/upload-local.js`:

- reads a local JSON file
- validates that the file contains valid JSON
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

Successful output:

- upload prints a line like `Uploaded JSON to s3://your-bucket/sample.json`
- download prints the JSON document in pretty-printed form

Common errors:

- missing `AWS_REGION` or `S3_BUCKET`
- invalid JSON file content
- local file not found
- S3 bucket not found
- S3 key not found
- AWS credential or permission errors

## Stage 2 - AWS Deployment

`scripts/deploy-aws.js` performs the AWS deployment flow. It:

- packages the Lambda handlers
- creates or updates the Lambda execution role and policies
- creates or updates the Lambda functions
- generates the deployment-specific OpenAPI file
- uploads the generated OpenAPI file to S3
- creates or updates API Gateway from OpenAPI
- deploys an API stage
- grants API Gateway permission to invoke the Lambda functions

The deployed handlers are:

- `src/handlers/postJson.handler`
- `src/handlers/getJson.handler`

`scripts/verify-api.js` performs a real API check against the deployed API Gateway endpoint by:

- sending a POST request with a generated JSON payload
- sending a GET request for the same key
- printing the status codes and returned bodies

Commands:

```bash
npm run deploy:aws
npm run verify:aws
```

Successful output:

- deploy prints the Lambda names, generated OpenAPI S3 path, API Gateway ID, and invoke URL
- verify prints `POST status: 200` and `GET status: 200` plus the returned bodies

## OpenAPI and API Gateway

`openapi/openapi.yaml` is the canonical OpenAPI template committed with the project.

During deployment, `scripts/deploy-aws.js` creates `.deploy/openapi.generated.yaml` by replacing these placeholders with real deployment values:

- `__AWS_REGION__`
- `__POST_LAMBDA_ARN__`
- `__GET_LAMBDA_ARN__`

That generated file is then:

- uploaded to S3 as a deploy artifact
- used as the source for API Gateway import or update

The generated file is not a source-of-truth file.

## Tests

Run tests with:

```bash
npm test
```

`npm test` covers mocked unit tests for:

- S3 service upload/download behavior
- S3 error mapping for missing key and missing bucket
- POST handler success and invalid-request handling
- GET handler success, not-found, missing-key, and server-error handling
- OpenAPI template parsing and route presence

These tests do not call real AWS services.

`npm run verify:aws` is the real end-to-end AWS verification step.

## IAM Permissions

Stage 1 uses your configured AWS credentials, so those credentials must allow access to the chosen S3 bucket.

Stage 2 creates or reuses a Lambda execution role with:

- CloudWatch logging permissions through `AWSLambdaBasicExecutionRole`
- S3 permissions needed by the handlers for `ListBucket`, `GetObject`, and `PutObject`

## Submission Notes

Minimal reviewer flow:

1. `npm install`
2. Configure AWS credentials
3. Stage 1:
   - `npm run upload:local -- data/sample.json sample.json`
   - `npm run download:local -- sample.json`
4. Stage 2:
   - `npm run deploy:aws`
   - `npm run verify:aws`

What to expect:

- Stage 1 proves direct S3 upload and download using the AWS SDK
- Stage 2 proves Lambda and API Gateway deployment using the OpenAPI template
- `npm test` provides fast mocked unit coverage
