/**
 * @fileoverview Normalize test-trust Commander flags (defensive for -d/-v/--revalidate).
 */

'use strict';

const { cliOptsSkipSync } = require('../utils/cli-sync-options');

/**
 * @param {Object} options - Commander-parsed options
 * @param {import('commander').Command} [cmd]
 * @returns {Object}
 */
function normalizeTestTrustCliOptions(options, cmd) {
  const raw = cmd && Array.isArray(cmd.rawArgs) ? cmd.rawArgs : [];
  const has = flag => raw.includes(flag);
  return {
    ...options,
    debug: options.debug === true || has('-d') || has('--debug'),
    verbose: options.verbose === true || has('-v') || has('--verbose'),
    revalidate: options.revalidate === true || has('--revalidate'),
    noSync: cliOptsSkipSync(options, cmd),
    strict: options.strict === true || has('--strict'),
    summary: options.summary === true || has('--summary'),
    json: options.json === true || has('--json'),
    warningsAsErrors: options.warningsAsErrors === true || has('--warnings-as-errors')
  };
}

module.exports = {
  normalizeTestTrustCliOptions
};
