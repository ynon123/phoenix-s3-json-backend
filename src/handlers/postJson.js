'use strict';

const { getConfig } = require('../config/env');
const logger = require('../utils/logger');
const { jsonResponse } = require('../utils/response');
const { createS3Client, putJson } = require('../services/s3Service');

function parseJsonBody(body) {
  if (!body) {
    throw new Error('Body is required');
  }
  return JSON.parse(body);
}

async function handler(event, context) {
  const metadata = {
    requestId: context && context.awsRequestId,
    path: event && event.path,
    method: event && event.httpMethod
  };

  try {
    const key = event && event.pathParameters && event.pathParameters.key;
    if (!key) {
      return jsonResponse(400, { message: 'Path parameter "key" is required' });
    }

    const payload = parseJsonBody(event.body);
    const config = getConfig();
    const client = createS3Client(config.region);

    const storedKey = await putJson(client, config.bucket, key, payload, config.prefix);
    logger.info('JSON uploaded to S3', { ...metadata, key: storedKey, bucket: config.bucket });

    return jsonResponse(200, {
      key: storedKey,
      bucket: config.bucket
    });
  } catch (err) {
    if (err instanceof SyntaxError || err.message === 'Body is required') {
      logger.error('Invalid JSON request body', { ...metadata, error: err.message });
      return jsonResponse(400, { message: 'Invalid JSON body' });
    }

    logger.error('Failed to upload JSON to S3', { ...metadata, error: err.message });
    return jsonResponse(500, { message: 'Internal Server Error' });
  }
}

module.exports = {
  handler,
  parseJsonBody
};
