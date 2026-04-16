/**
 * @fileoverview POST + optional poll for unified validation run (keeps main module small).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { postValidationRunAndOptionalPoll } = require('../api/validation-runner');

/**
 * @param {Object} opts
 * @param {string} opts.dataplaneUrl
 * @param {Object} opts.authConfig
 * @param {Object} opts.body
 * @param {number} opts.timeoutMs
 * @param {boolean} opts.useAsync
 * @param {boolean} opts.noAsync
 * @returns {Promise<{ envelope: Object|null, apiError: Object|null, pollTimedOut: boolean, incompleteNoAsync: boolean }>}
 */
/* eslint-disable max-lines-per-function, max-statements, complexity -- POST + poll orchestration */
// Re-exported thin wrapper; single implementation lives in lib/api/validation-runner.js
/* eslint-enable max-lines-per-function, max-statements, complexity */

module.exports = { postValidationRunAndOptionalPoll };
