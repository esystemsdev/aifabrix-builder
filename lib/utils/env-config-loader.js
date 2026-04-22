/**
 * Environment config loader — infra defaults live in code ({@link module:lib/utils/infra-env-defaults}).
 *
 * @fileoverview Replaces lib/schema/env-config.yaml + user merge
 * @author AI Fabrix Team
 * @version 2.1.0
 */

'use strict';

const { getDefaultEnvConfig } = require('./infra-env-defaults');

/**
 * Schema-only env-config (sync). Used for *_PUBLIC_PORT canonical bases.
 * @returns {Object}
 */
function loadSchemaEnvConfig() {
  return getDefaultEnvConfig();
}

/**
 * Load env config for interpolation (same as schema; no external YAML).
 * @returns {Promise<Object>}
 */
async function loadEnvConfig() {
  return getDefaultEnvConfig();
}

module.exports = {
  loadEnvConfig,
  loadSchemaEnvConfig
};
