'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const archiver = require('archiver');
const {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand
} = require('@aws-sdk/client-s3');
const {
  STSClient,
  GetCallerIdentityCommand
} = require('@aws-sdk/client-sts');
const {
  IAMClient,
  GetRoleCommand,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  PutRolePolicyCommand
} = require('@aws-sdk/client-iam');
const {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  AddPermissionCommand,
  GetPolicyCommand,
  RemovePermissionCommand,
  waitUntilFunctionActiveV2,
  waitUntilFunctionUpdatedV2
} = require('@aws-sdk/client-lambda');
const {
  APIGatewayClient,
  GetRestApisCommand,
  ImportRestApiCommand,
  PutRestApiCommand,
  CreateDeploymentCommand
} = require('@aws-sdk/client-api-gateway');

if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (_) {}
}

const ROOT_DIR = path.resolve(__dirname, '..');
const DEPLOY_DIR = path.join(ROOT_DIR, '.deploy');
const BUILD_DIR = path.join(DEPLOY_DIR, 'lambda-build');
const ZIP_PATH = path.join(DEPLOY_DIR, 'lambda.zip');
const OPENAPI_TEMPLATE_PATH = path.join(ROOT_DIR, 'openapi', 'openapi.yaml');
const OPENAPI_GENERATED_PATH = path.join(DEPLOY_DIR, 'openapi.generated.yaml');
const OUTPUT_PATH = path.join(DEPLOY_DIR, 'aws-deploy-output.json');

function sanitizeBucketName(name) {
  return name.toLowerCase().replace(/[^a-z0-9.-]/g, '-').replace(/^-+|-+$/g, '');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rmIfExists(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function createZip(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function ensureBucketExists(s3Client, bucket, region) {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch (_) {}

  const params = { Bucket: bucket };
  if (region !== 'us-east-1') {
    params.CreateBucketConfiguration = { LocationConstraint: region };
  }

  await s3Client.send(new CreateBucketCommand(params));
}

async function ensureRole(iamClient, roleName, bucket) {
  let roleArn;
  let createdRole = false;

  try {
    const existing = await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
    roleArn = existing.Role.Arn;
  } catch (err) {
    if (err.name !== 'NoSuchEntity' && err.name !== 'NoSuchEntityException') {
      throw err;
    }

    const assumeRolePolicyDocument = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole'
        }
      ]
    });

    const created = await iamClient.send(
      new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: assumeRolePolicyDocument,
        Description: 'Execution role for PhoenixChallenge Lambda functions'
      })
    );

    roleArn = created.Role.Arn;
    createdRole = true;
  }

  if (createdRole) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  await iamClient.send(
    new AttachRolePolicyCommand({
      RoleName: roleName,
      PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
    })
  );

  await iamClient.send(
    new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: `${roleName}-s3-object-access`,
      PolicyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              's3:ListBucket'
            ],
            Resource: `arn:aws:s3:::${bucket}`
          },
          {
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:PutObject'
            ],
            Resource: `arn:aws:s3:::${bucket}/*`
          }
        ]
      })
    })
  );

  return roleArn;
}
async function upsertLambda(lambdaClient, params) {
  const {
    functionName,
    handler,
    roleArn,
    zipBuffer,
    bucket,
    prefix
  } = params;

  try {
    await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));

    await lambdaClient.send(
      new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: zipBuffer,
        Publish: true
      })
    );

    await waitUntilFunctionUpdatedV2({ client: lambdaClient, maxWaitTime: 120 }, { FunctionName: functionName });

    await lambdaClient.send(
      new UpdateFunctionConfigurationCommand({
        FunctionName: functionName,
        Runtime: 'nodejs20.x',
        Handler: handler,
        Role: roleArn,
        Timeout: 15,
        MemorySize: 256,
        Environment: {
          Variables: {
            S3_BUCKET: bucket,
            S3_PREFIX: prefix || ''
          }
        }
      })
    );

    await waitUntilFunctionUpdatedV2({ client: lambdaClient, maxWaitTime: 120 }, { FunctionName: functionName });
  } catch (err) {
    if (err.name !== 'ResourceNotFoundException') {
      throw err;
    }

    await lambdaClient.send(
      new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: 'nodejs20.x',
        Handler: handler,
        Role: roleArn,
        Code: { ZipFile: zipBuffer },
        Timeout: 15,
        MemorySize: 256,
        Environment: {
          Variables: {
            S3_BUCKET: bucket,
            S3_PREFIX: prefix || ''
          }
        },
        Publish: true
      })
    );

    await waitUntilFunctionActiveV2({ client: lambdaClient, maxWaitTime: 120 }, { FunctionName: functionName });
  }

  const finalConfig = await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));
  return finalConfig.Configuration.FunctionArn;
}

async function upsertApi(apiGatewayClient, apiName, openApiContent) {
  let restApiId = process.env.REST_API_ID || null;

  if (!restApiId && fs.existsSync(OUTPUT_PATH)) {
    try {
      const previousOutput = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      restApiId = previousOutput.apiId || null;
    } catch (_) {}
  }

  if (restApiId) {
    try {
      await apiGatewayClient.send(
        new PutRestApiCommand({
          restApiId,
          mode: 'overwrite',
          failOnWarnings: true,
          body: Buffer.from(openApiContent)
        })
      );
      return restApiId;
    } catch (err) {
      if (err.name !== 'NotFoundException') {
        throw err;
      }
      restApiId = null;
    }
  }

  const apis = await apiGatewayClient.send(new GetRestApisCommand({ limit: 500 }));
  const existing = (apis.items || []).find((item) => item.name === apiName);

  if (existing) {
    await apiGatewayClient.send(
      new PutRestApiCommand({
        restApiId: existing.id,
        mode: 'overwrite',
        failOnWarnings: true,
        body: Buffer.from(openApiContent)
      })
    );
    return existing.id;
  }

  const imported = await apiGatewayClient.send(
    new ImportRestApiCommand({
      failOnWarnings: true,
      body: Buffer.from(openApiContent)
    })
  );
  return imported.id;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLambdaReady(lambdaClient, functionName) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const response = await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));
    const config = response.Configuration || {};

    if (config.State === 'Active' && config.LastUpdateStatus === 'Successful') {
      return;
    }

    if (config.State === 'Failed' || config.LastUpdateStatus === 'Failed') {
      throw new Error(`Lambda not ready: state=${config.State} lastUpdateStatus=${config.LastUpdateStatus}`);
    }

    await sleep(3000);
  }

  throw new Error('Timed out waiting for Lambda to become ready.');
}

function hasValueOrPrefix(value, expected) {
  if (!value) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasValueOrPrefix(entry, expected));
  }
  if (value === expected) {
    return true;
  }
  if (typeof value === 'string' && value.endsWith('*')) {
    return expected.startsWith(value.slice(0, -1));
  }
  return false;
}

function isAcceptablePermission(statement, sourceArn) {
  if (!statement) {
    return false;
  }

  const principal = statement.Principal && (statement.Principal.Service || statement.Principal);
  const action = statement.Action;
  const condition = statement.Condition || {};

  const arnLike = (condition.ArnLike || condition.StringLike || {});
  const source = arnLike['AWS:SourceArn'] || arnLike['aws:SourceArn'];

  const principalOk = principal === 'apigateway.amazonaws.com';
  const actionOk = hasValueOrPrefix(action, 'lambda:InvokeFunction');
  const sourceOk = hasValueOrPrefix(source, sourceArn);

  return principalOk && actionOk && sourceOk;
}

async function getPermissionStatement(lambdaClient, functionName, statementId) {
  try {
    const policyResult = await lambdaClient.send(new GetPolicyCommand({ FunctionName: functionName }));
    const policy = JSON.parse(policyResult.Policy || '{}');
    const statements = policy.Statement || [];
    return statements.find((statement) => statement.Sid === statementId) || null;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      return null;
    }
    throw err;
  }
}

async function addInvokePermission(lambdaClient, functionName, sourceArn, statementId) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await waitForLambdaReady(lambdaClient, functionName);

    try {
      await lambdaClient.send(
        new AddPermissionCommand({
          FunctionName: functionName,
          StatementId: statementId,
          Action: 'lambda:InvokeFunction',
          Principal: 'apigateway.amazonaws.com',
          SourceArn: sourceArn
        })
      );
      return;
    } catch (err) {
      if (err.name === 'ResourceConflictException') {
        const existing = await getPermissionStatement(lambdaClient, functionName, statementId);

        if (existing && isAcceptablePermission(existing, sourceArn)) {
          return;
        }

        if (existing) {
          await lambdaClient.send(
            new RemovePermissionCommand({
              FunctionName: functionName,
              StatementId: statementId
            })
          );
        }

        await sleep(2000);
        continue;
      }

      if (err.name === 'TooManyRequestsException' || err.name === 'ResourceNotReadyException' || err.name === 'ResourceNotReady') {
        await sleep(3000);
        continue;
      }

      throw err;
    }
  }

  throw new Error('Unable to add Lambda invoke permission after retries.');
}

async function main() {
  ensureDir(DEPLOY_DIR);

  const region = process.env.AWS_REGION || 'us-east-1';
  const prefix = process.env.S3_PREFIX || '';
  const deployPrefix = (process.env.DEPLOY_PREFIX || 'phoenixchallenge').toLowerCase();
  const postFunctionName = process.env.POST_FUNCTION_NAME || `${deployPrefix}-post-json`;
  const getFunctionName = process.env.GET_FUNCTION_NAME || `${deployPrefix}-get-json`;
  const roleName = process.env.LAMBDA_ROLE_NAME || `${deployPrefix}-lambda-role`;
  const apiName = process.env.API_NAME || `${deployPrefix}-api`;
  const stageName = process.env.API_STAGE || 'prod';

  const stsClient = new STSClient({ region });
  const caller = await stsClient.send(new GetCallerIdentityCommand({}));
  const accountId = caller.Account;

  const autoBucket = sanitizeBucketName(`${deployPrefix}-${accountId}-${region}-json`);
  const dataBucket = process.env.S3_BUCKET || autoBucket;
  const swaggerBucket = process.env.DEPLOY_S3_BUCKET || dataBucket;

  const s3Client = new S3Client({ region });
  await ensureBucketExists(s3Client, dataBucket, region);
  await ensureBucketExists(s3Client, swaggerBucket, region);

  const iamClient = new IAMClient({ region });
  const lambdaClient = new LambdaClient({ region });
  const apiGatewayClient = new APIGatewayClient({ region });

  const roleArn = process.env.LAMBDA_ROLE_ARN || (await ensureRole(iamClient, roleName, dataBucket));

  rmIfExists(BUILD_DIR);
  ensureDir(BUILD_DIR);

  copyRecursive(path.join(ROOT_DIR, 'src'), path.join(BUILD_DIR, 'src'));
  fs.copyFileSync(path.join(ROOT_DIR, 'package.json'), path.join(BUILD_DIR, 'package.json'));
  fs.copyFileSync(path.join(ROOT_DIR, 'package-lock.json'), path.join(BUILD_DIR, 'package-lock.json'));

  run('npm', ['ci', '--omit=dev'], BUILD_DIR);

  rmIfExists(ZIP_PATH);
  await createZip(BUILD_DIR, ZIP_PATH);
  const zipBuffer = fs.readFileSync(ZIP_PATH);

  const postLambdaArn = await upsertLambda(lambdaClient, {
    functionName: postFunctionName,
    handler: 'src/handlers/postJson.handler',
    roleArn,
    zipBuffer,
    region,
    bucket: dataBucket,
    prefix
  });

  const getLambdaArn = await upsertLambda(lambdaClient, {
    functionName: getFunctionName,
    handler: 'src/handlers/getJson.handler',
    roleArn,
    zipBuffer,
    region,
    bucket: dataBucket,
    prefix
  });

  const openApiTemplate = fs.readFileSync(OPENAPI_TEMPLATE_PATH, 'utf8');
  const openApiGenerated = openApiTemplate
    .replace(/__AWS_REGION__/g, region)
    .replace(/__POST_LAMBDA_ARN__/g, postLambdaArn)
    .replace(/__GET_LAMBDA_ARN__/g, getLambdaArn);

  fs.writeFileSync(OPENAPI_GENERATED_PATH, openApiGenerated, 'utf8');

  const swaggerKey = `.deploy/openapi.generated.yaml`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: swaggerBucket,
      Key: swaggerKey,
      Body: openApiGenerated,
      ContentType: 'application/yaml'
    })
  );

  const restApiId = await upsertApi(apiGatewayClient, apiName, openApiGenerated);
  await apiGatewayClient.send(new CreateDeploymentCommand({ restApiId, stageName }));

  const sourceArn = `arn:aws:execute-api:${region}:${accountId}:${restApiId}/*/*/json/*`;
  await addInvokePermission(lambdaClient, postFunctionName, sourceArn, 'AllowApiGatewayInvokePost');
  await addInvokePermission(lambdaClient, getFunctionName, sourceArn, 'AllowApiGatewayInvokeGet');

  const invokeUrl = `https://${restApiId}.execute-api.${region}.amazonaws.com/${stageName}`;
  const output = {
    region,
    accountId,
    dataBucket,
    swaggerBucket,
    swaggerS3Path: `s3://${swaggerBucket}/${swaggerKey}`,
    postFunctionName,
    postLambdaArn,
    getFunctionName,
    getLambdaArn,
    apiName,
    apiId: restApiId,
    stageName,
    apiInvokeUrl: invokeUrl,
    handlerMap: {
      post: 'src/handlers/postJson.handler',
      get: 'src/handlers/getJson.handler'
    }
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log('Deployment complete');
  console.log(`POST Lambda: ${postFunctionName}`);
  console.log(`GET Lambda: ${getFunctionName}`);
  console.log(`Swagger S3 path: s3://${swaggerBucket}/${swaggerKey}`);
  console.log(`API Gateway ID: ${restApiId}`);
  console.log(`API Invoke URL: ${invokeUrl}`);
  console.log(`Deployment metadata: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});













