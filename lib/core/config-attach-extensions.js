/**
 * Attach token, path, format, and scoped-resources helpers to config exports.
 *
 * @fileoverview Keeps lib/core/config.js under max-lines
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/**
 * @param {object} exportsObj - Module exports object to mutate
 * @param {object} deps
 * @param {Function} deps.getConfig
 * @param {Function} deps.saveConfig
 * @param {Function} deps.getSecretsEncryptionKey
 * @param {Function} deps.encryptTokenValue
 * @param {Function} deps.decryptTokenValue
 */
function attachConfigExtensions(exportsObj, deps) {
  const { getConfig, saveConfig, getSecretsEncryptionKey, encryptTokenValue, decryptTokenValue } = deps;

  const { createTokenManagementFunctions } = require('../utils/config-tokens');
  Object.assign(
    exportsObj,
    createTokenManagementFunctions({
      getConfigFn: getConfig,
      saveConfigFn: saveConfig,
      getSecretsEncryptionKeyFn: getSecretsEncryptionKey,
      encryptTokenValueFn: encryptTokenValue,
      decryptTokenValueFn: decryptTokenValue,
      isTokenEncryptedFn: require('../utils/token-encryption').isTokenEncrypted
    })
  );

  const { createPathConfigFunctions } = require('../utils/config-paths');
  Object.assign(exportsObj, createPathConfigFunctions(getConfig, saveConfig));

  const { createFormatFunctions } = require('../utils/config-format-preference');
  Object.assign(exportsObj, createFormatFunctions(getConfig, saveConfig));

  const { createScopedResourcesPreferenceFunctions } = require('../utils/config-scoped-resources-preference');
  Object.assign(exportsObj, createScopedResourcesPreferenceFunctions(getConfig, saveConfig));
}

module.exports = { attachConfigExtensions };
