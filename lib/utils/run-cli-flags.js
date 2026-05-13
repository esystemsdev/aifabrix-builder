/**
 * Normalize Commander flags for `aifabrix run`.
 *
 * @fileoverview Commander v11 pairs `--no-proxy` with a default-true `--proxy` flag as `options.proxy === false`.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * True when the user disabled proxy hints: explicit `--no-proxy` or `proxy === false` when supported.
 *
 * @param {Object} [options] - Commander action options
 * @returns {boolean}
 */
function isRunCliNoProxy(options) {
  if (!options || typeof options !== 'object') {
    return false;
  }
  if (options.proxy === false) {
    return true;
  }
  return options.noProxy === true;
}

module.exports = {
  isRunCliNoProxy
};
