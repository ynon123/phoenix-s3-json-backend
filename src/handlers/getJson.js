'use strict';

const { getConfig } = require('../config/env');
const logger = require('../utils/logger');
const { jsonResponse } = require('../utils/response');
const { createS3Client, getJson } = require('../services/s3Service');

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

    const config = getConfig();
    const client = createS3Client(config.region);

    const result = await getJson(client, config.bucket, key, config.prefix);
    logger.info('JSON downloaded from S3', { ...metadata, key: result.key, bucket: config.bucket });

    return jsonResponse(200, result.data);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      logger.error('JSON key not found in S3', { ...metadata, error: err.message });
      return jsonResponse(404, { message: 'Not Found' });
    }

    logger.error('Failed to download JSON from S3', { ...metadata, error: err.message });
    return jsonResponse(500, { message: 'Internal Server Error' });
  }
}

module.exports = {
  handler
};
