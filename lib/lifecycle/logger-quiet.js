/**
 * @fileoverview Suppress CLI logger output during orchestration (verify-operations).
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');

/**
 * Run async fn with logger.log temporarily disabled.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withQuietLogs(fn) {
  const prev = logger.log;
  logger.log = () => {};
  try {
    return await fn();
  } finally {
    logger.log = prev;
  }
}

module.exports = {
  withQuietLogs
};
