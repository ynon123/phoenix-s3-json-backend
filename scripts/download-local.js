'use strict';

const { getConfig } = require('../src/config/env');
const { createS3Client, getJson } = require('../src/services/s3Service');

async function main() {
  const key = process.argv[2];

  if (!key) {
    console.error('Usage: npm run download:local -- <s3-key>');
    process.exitCode = 1;
    return;
  }

  try {
    const config = getConfig();
    const client = createS3Client(config.region);
    const result = await getJson(client, config.bucket, key, config.prefix);

    console.log(JSON.stringify(result.data, null, 2));
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      console.error('Key not found in S3.');
    } else if (err.code === 'BUCKET_NOT_FOUND' || err.name === 'NoSuchBucket') {
      console.error('Bucket not found. Check S3_BUCKET and AWS account/region access.');
    } else {
      console.error(err.message || 'Download failed.');
    }
    process.exitCode = 1;
  }
}

main();
