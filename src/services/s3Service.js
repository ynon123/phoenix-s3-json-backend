'use strict';

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

function createS3Client(region) {
  return new S3Client({ region });
}

function withPrefix(prefix, key) {
  if (!prefix) {
    return key;
  }
  const cleanPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return `${cleanPrefix}/${key}`;
}

async function putJson(client, bucket, key, data, prefix = '') {
  const objectKey = withPrefix(prefix, key);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: JSON.stringify(data),
      ContentType: 'application/json'
    })
  );
  return objectKey;
}

function streamToString(stream) {
  if (!stream) {
    return Promise.resolve('');
  }
  if (typeof stream.transformToString === 'function') {
    return stream.transformToString();
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

function isBucketNotFoundError(err) {
  return err && (
    err.name === 'NoSuchBucket' ||
    err.Code === 'NoSuchBucket' ||
    err.code === 'NoSuchBucket' ||
    err.$metadata && err.$metadata.httpStatusCode === 404 && /bucket/i.test(err.message || '')
  );
}

async function getJson(client, bucket, key, prefix = '') {
  const objectKey = withPrefix(prefix, key);

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey
      })
    );

    const rawBody = await streamToString(response.Body);
    return {
      key: objectKey,
      data: JSON.parse(rawBody)
    };
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      const notFoundError = new Error('Object not found');
      notFoundError.code = 'NOT_FOUND';
      throw notFoundError;
    }
    if (isBucketNotFoundError(err)) {
      const bucketError = new Error('Bucket not found');
      bucketError.code = 'BUCKET_NOT_FOUND';
      throw bucketError;
    }
    throw err;
  }
}

module.exports = {
  createS3Client,
  putJson,
  getJson,
  withPrefix,
  streamToString
};
