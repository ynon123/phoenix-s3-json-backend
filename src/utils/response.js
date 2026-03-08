'use strict';

const defaultHeaders = {
  'content-type': 'application/json'
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(body)
  };
}

module.exports = {
  jsonResponse
};
