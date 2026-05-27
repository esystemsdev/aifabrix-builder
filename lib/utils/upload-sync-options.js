/**
 * Build options for `uploadExternalSystem` on test-command --sync paths.
 *
 * @fileoverview Minimal upload sync options (force, verbose)
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {Object} [options] - CLI options from test / sync callers
 * @returns {{ minimal: true, verbose: boolean, force?: true }}
 */
function buildMinimalUploadSyncOptions(options = {}) {
  const out = {
    minimal: true,
    verbose: options.verbose === true
  };
  if (options.force === true) {
    out.force = true;
  }
  return out;
}

module.exports = {
  buildMinimalUploadSyncOptions
};
