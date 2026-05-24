/**
 * Suppress verbose CLI detail during `aifabrix setup` (guided milestones only).
 *
 * @fileoverview Setup quiet output flag
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @returns {boolean} True while `aifabrix setup` is running
 */
function isSetupQuietOutput() {
  try {
    const { isSetupCommandFlow } = require('../commands/setup-run-context');
    return isSetupCommandFlow();
  } catch {
    return false;
  }
}

module.exports = {
  isSetupQuietOutput
};
