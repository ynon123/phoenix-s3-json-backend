'use strict';

const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (_) {}
}

const OUTPUT_PATH = path.resolve(__dirname, '..', '.deploy', 'aws-deploy-output.json');

function getInvokeUrl() {
  if (process.env.API_INVOKE_URL) {
    return process.env.API_INVOKE_URL;
  }

  if (fs.existsSync(OUTPUT_PATH)) {
    const data = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    if (data.apiInvokeUrl) {
      return data.apiInvokeUrl;
    }
  }

  throw new Error('API invoke URL not found. Run npm run deploy:aws first or set API_INVOKE_URL.');
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
