/**
 * @fileoverview Temporarily mute logger.log output for guided UX flows.
 *
 * Used by guided installer-style commands (e.g. up-platform default mode) to avoid
 * streaming orchestration mechanics while preserving errors and warnings.
 */

'use strict';

const logger = require('./logger');

/**
 * Run a function while muting logger.log/info.
 *
 * - logger.error and logger.warn are preserved.
 * - An optional allowlist can let specific messages through (rare).
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ allow?: ((...args: any[]) => boolean) }} [opts]
 * @returns {Promise<T>}
 */
async function withMutedLogger(fn, opts = {}) {
  const original = {
    log: logger.log,
    info: logger.info
  };

  const allow = typeof opts.allow === 'function' ? opts.allow : null;

  const muted = (...args) => {
    try {
      if (allow && allow(...args)) {
        return original.log(...args);
      }
    } catch {
      // ignore allow errors; treat as muted
    }
    return undefined;
  };

  logger.log = muted;
  logger.info = muted;
  try {
    return await fn();
  } finally {
    logger.log = original.log;
    logger.info = original.info;
  }
}

module.exports = { withMutedLogger };

