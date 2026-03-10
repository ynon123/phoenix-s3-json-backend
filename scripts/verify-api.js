'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (_) {}
}

const ROOT_DIR = path.resolve(__dirname, '..');
const TERRAFORM_OUTPUT_PATH = path.join(ROOT_DIR, '.deploy', 'terraform-output.json');

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function getInvokeUrlFromTerraformOutput(output) {
  if (!output || !output.api_invoke_url) {
    return null;
  }

  return typeof output.api_invoke_url === 'string'
    ? output.api_invoke_url
    : output.api_invoke_url.value || null;
}

function getInvokeUrlFromTerraformCli() {
  const result = spawnSync('terraform', ['-chdir=terraform', 'output', '-json'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  const parsed = JSON.parse(result.stdout);
  const invokeUrl = getInvokeUrlFromTerraformOutput(parsed);

  if (invokeUrl) {
    fs.mkdirSync(path.dirname(TERRAFORM_OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(TERRAFORM_OUTPUT_PATH, JSON.stringify(parsed, null, 2));
  }

  return invokeUrl;
}

function getInvokeUrl() {
  if (process.env.API_INVOKE_URL) {
    return process.env.API_INVOKE_URL;
  }

  const liveTerraformInvokeUrl = getInvokeUrlFromTerraformCli();
  if (liveTerraformInvokeUrl) {
    return liveTerraformInvokeUrl;
  }

  const terraformOutput = readJsonFile(TERRAFORM_OUTPUT_PATH);
  const terraformInvokeUrl = getInvokeUrlFromTerraformOutput(terraformOutput);
  if (terraformInvokeUrl) {
    return terraformInvokeUrl;
  }

  throw new Error('API invoke URL not found. Run npm run terraform:apply first, or set API_INVOKE_URL.');
}

async function main() {
  const invokeUrl = getInvokeUrl().replace(/\/$/, '');
  const key = `verify-${Date.now()}.json`;
  const payload = {
    source: 'verify-aws-script',
    timestamp: new Date().toISOString()
  };

  const postResp = await fetch(`${invokeUrl}/json/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const postText = await postResp.text();
  console.log(`POST status: ${postResp.status}`);
  console.log(postText);

  if (!postResp.ok) {
    throw new Error('POST verification failed.');
  }

  const getResp = await fetch(`${invokeUrl}/json/${encodeURIComponent(key)}`);
  const getText = await getResp.text();
  console.log(`GET status: ${getResp.status}`);
  console.log(getText);

  if (!getResp.ok) {
    throw new Error('GET verification failed.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
