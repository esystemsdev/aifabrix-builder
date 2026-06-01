/**
 * @fileoverview Exit codes for Enterprise AI Certification verify commands.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { VERDICT } = require('./product-model');

/**
 * @param {string} verdict
 * @param {{ partial?: boolean }} [opts]
 * @returns {number}
 */
function exitCodeFromVerdict(verdict, opts = {}) {
  if (opts.partial === true) return 2;
  if (verdict === VERDICT.VERIFIED) return 0;
  return 1;
}

module.exports = {
  exitCodeFromVerdict
};
