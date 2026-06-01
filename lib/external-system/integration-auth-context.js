/**
 * Reuse dataplane auth resolved during sync/upload across verify and test commands.
 *
 * @fileoverview Integration auth context helpers
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { setupIntegrationTestAuth } = require('./test-auth');
const { getConfig } = require('../core/config');

/**
 * @param {Object} options
 * @returns {Object}
 */
function integrationAuthOptions(options) {
  const base = {
    environment: options.env,
    silentResolve: options.silentResolve === true
  };
  if (options.authConfig && options.dataplaneUrl) {
    return { ...base, authConfig: options.authConfig, dataplaneUrl: options.dataplaneUrl };
  }
  return base;
}

/**
 * @param {string} systemKey
 * @param {Object} options
 * @returns {Promise<{ authConfig: Object, dataplaneUrl: string }>}
 */
async function resolveIntegrationAuth(systemKey, options) {
  if (options.authConfig && options.dataplaneUrl) {
    return { authConfig: options.authConfig, dataplaneUrl: options.dataplaneUrl };
  }
  const configObj = await getConfig();
  return setupIntegrationTestAuth(systemKey, integrationAuthOptions(options), configObj);
}

module.exports = {
  integrationAuthOptions,
  resolveIntegrationAuth
};
