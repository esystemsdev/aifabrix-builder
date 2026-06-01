/**
 * @fileoverview Machine-readable --json envelopes for verify + lifecycle commands.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {Object} base
 * @param {boolean} includeDetails
 * @returns {Object}
 */
function buildJsonEnvelope(base, includeDetails) {
  const out = { ...base };
  if (!includeDetails) {
    delete out.details;
    delete out.readinessMetrics;
  }
  return out;
}

module.exports = {
  buildJsonEnvelope
};
