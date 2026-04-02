/**
 * MISO_ENVIRONMENT value for generated compose / docker run.
 *
 * @fileoverview Extracted from compose-generator to respect max-lines
 */

'use strict';

/**
 * @param {Object} options - Run options
 * @returns {'dev'|'tst'|'pro'}
 */
function resolveMisoEnvironment(options) {
  const env = (options.env && typeof options.env === 'string') ? options.env.toLowerCase() : 'dev';
  return (env === 'tst' || env === 'pro') ? env : 'dev';
}

module.exports = { resolveMisoEnvironment };
