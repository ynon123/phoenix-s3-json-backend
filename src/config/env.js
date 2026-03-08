'use strict';

const path = require('path');

function loadLocalEnv() {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  try {
    require('dotenv').config({
      path: path.resolve(process.cwd(), '.env')
    });
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
  }
}

loadLocalEnv();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getConfig() {
  return {
    region: requireEnv('AWS_REGION'),
    bucket: requireEnv('S3_BUCKET'),
    prefix: process.env.S3_PREFIX || ''
  };
}

module.exports = {
  getConfig
};
