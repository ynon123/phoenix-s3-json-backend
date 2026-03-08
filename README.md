# Phoenix S3 JSON Backend

Submission-ready Node.js assignment project for S3 JSON upload/download with Lambda handlers and API Gateway automation.

## Lambda Handlers

- POST handler: `src/handlers/postJson.handler`
- GET handler: `src/handlers/getJson.handler`

Both handlers reuse the shared services/config modules under `src/services` and `src/config`.

## OpenAPI Files

- Template: `openapi/openapi.yaml`
- Generated during deployment: `.deploy/openapi.generated.yaml`

Template placeholders replaced by deployment script:

- `__AWS_REGION__`
- `__POST_LAMBDA_ARN__`
- `__GET_LAMBDA_ARN__`

## Environment Variables

Required for deploy/local:

- `AWS_REGION`
- `S3_BUCKET` (optional for deploy: if empty, deploy script auto-generates one)

Optional:

- `S3_PREFIX`
- `AWS_PROFILE`
- `DEPLOY_PREFIX`
- `API_NAME`
- `API_STAGE`
- `POST_FUNCTION_NAME`
- `GET_FUNCTION_NAME`
- `DEPLOY_S3_BUCKET`
- `LAMBDA_ROLE_ARN`

## Reviewer Quick Start

1. `npm install`
2. Configure AWS credentials (`aws configure` or env vars)
3. Optional: copy `.env.example` to `.env` and set values
4. `npm run deploy:aws`
5. `npm run verify:aws`

## AWS Credential Check

```bash
aws sts get-caller-identity
```

## Deployment Automation

`npm run deploy:aws` performs end-to-end setup:

- packages Lambda handlers
- creates/updates Lambda functions
- creates role if needed (unless `LAMBDA_ROLE_ARN` provided)
- uploads generated Swagger to S3
- imports/updates API Gateway from generated OpenAPI
- deploys API stage
- grants API Gateway permission to invoke Lambda

After deployment it prints:

- Lambda function names
- Swagger S3 path
- API Gateway ID
- API invoke URL

It also writes deployment metadata to `.deploy/aws-deploy-output.json`.

## API Verification

`npm run verify:aws` sends a real POST request to the deployed API and then fetches the same key with GET.

It reads invoke URL from:

1. `API_INVOKE_URL` env var (if set), else
2. `.deploy/aws-deploy-output.json`

## Local S3 Scripts (Direct)

Upload JSON directly to S3:

```bash
npm run upload:local -- data/sample.json sample.json
```

Download JSON directly from S3:

```bash
npm run download:local -- sample.json
```

## Tests

```bash
npm test
```

Tests remain mocked and focused on services/handlers.


