'use strict';

function base(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };

  return JSON.stringify(entry);
}

function info(message, meta = {}) {
  console.log(base('info', message, meta));
}

function error(message, meta = {}) {
  console.error(base('error', message, meta));
}

module.exports = {
  info,
  error
};
