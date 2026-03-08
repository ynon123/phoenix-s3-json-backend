'use strict';

const fs = require('fs');
const path = require('path');
const { getConfig } = require('../src/config/env');
const { createS3Client, putJson } = require('../src/services/s3Service');

async function main() {
  const filePath = process.argv[2];
  const key = process.argv[3];

  if (!filePath || !key) {
    console.error('Usage: npm run upload:local -- <json-file-path> <s3-key>');
    process.exitCode = 1;
    return;
  }

  try {
    const config = getConfig();
    const fullPath = path.resolve(process.cwd(), filePath);
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    const payload = JSON.parse(fileContent);

    const client = createS3Client(config.region);
    const storedKey = await putJson(client, config.bucket, key, payload, config.prefix);

    console.log(`Uploaded JSON to s3://${config.bucket}/${storedKey}`);
  } catch (err) {
    if (err.code === 'BUCKET_NOT_FOUND' || err.name === 'NoSuchBucket') {
      console.error('Bucket not found. Check S3_BUCKET and AWS account/region access.');
    } else if (err instanceof SyntaxError) {
      console.error('Invalid JSON file content.');
    } else if (err.code === 'ENOENT') {
      console.error(`File not found: ${filePath}`);
    } else {
      console.error(err.message || 'Upload failed.');
    }
    process.exitCode = 1;
  }
}

main();
