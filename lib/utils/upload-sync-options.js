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
 * @returns {{ minimal: true, verbose: boolean, silentResolve: true, syncMode: true, force?: true }}
 */
function buildMinimalUploadSyncOptions(options = {}) {
  const out = {
    minimal: true,
    // CLI -v on verify-* / test-* is for run output, not preflight upload banners.
    verbose: false,
    silentResolve: true,
    syncMode: true
  };
  if (options.force === true) {
    out.force = true;
  }
  return out;
}

/**
 * Minimal sync paths (verify-*, test --sync) always suppress upload sidecar chatter.
 * @param {Object} [options]
 * @returns {boolean}
 */
function isQuietMinimalSync(options = {}) {
  return options.minimal === true || options.syncMode === true;
}

module.exports = {
  buildMinimalUploadSyncOptions,
  isQuietMinimalSync
};
