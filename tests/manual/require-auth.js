/**
 * Resolve controller URL, environment, and auth config for manual tests.
 * Use only after auth validation has passed (setup.js runs "aifabrix auth status --validate").
 *
 * @fileoverview Auth/config helper for manual tests (real API calls)
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { getValidatedAuthContext } = require('../../lib/commands/auth-status');

/**
 * Get controller URL, environment, auth config, and optional dataplane URL for manual tests.
 * @async
 * @returns {Promise<{controllerUrl: string, environment: string, authConfig: Object, dataplaneUrl: string|null}>}
 * @throws {Error} If not authenticated (should not happen if setup validation passed)
 */
async function getManualTestAuth() {
  return await getValidatedAuthContext();
}

module.exports = { getManualTestAuth };
