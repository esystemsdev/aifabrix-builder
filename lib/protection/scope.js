/**
 * @fileoverview `.protection` scope token for top-level CLI commands.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const PROTECTION_SCOPE = '.protection';

/**
 * @param {string} arg
 * @returns {boolean}
 */
function isProtectionScope(arg) {
  return String(arg || '').trim() === PROTECTION_SCOPE;
}

module.exports = {
  PROTECTION_SCOPE,
  isProtectionScope
};
