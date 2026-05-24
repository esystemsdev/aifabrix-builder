/**
 * Sync admin passwords into catalog kv secrets store.
 *
 * @fileoverview {{adminPassword}} placeholder sync for setup / up-infra
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('../utils/logger');
const secretsEnsure = require('../core/secrets-ensure');

/**
 * @param {string} password
 * @returns {Promise<void>}
 */
async function syncAdminPasswordKeysToStore(password) {
  const trimmed = String(password || '').trim();
  if (!trimmed) return;
  try {
    const { syncLiteralKvSecretsFromCliOverrides } = require('../core/secrets-infra-placeholder-sync');
    const { buildInfraPlaceholderContext } = require('../core/secrets-ensure');
    const ipc = require('../parameters/infra-parameter-catalog');
    const placeholderContext = buildInfraPlaceholderContext({
      adminPassword: trimmed,
      adminPwd: trimmed
    });
    await syncLiteralKvSecretsFromCliOverrides(
      { adminPassword: trimmed, adminPwd: trimmed },
      placeholderContext,
      (key, val) => secretsEnsure.setSecretInStore(key, val),
      () => ipc
    );
  } catch (err) {
    logger.warn(`Could not sync admin password keys to secrets store: ${err.message}`);
  }
}

/**
 * @param {Object|null} bundle
 * @returns {Promise<void>}
 */
async function syncAdminKvFromPasswordBundle(bundle) {
  if (!bundle) return;
  if (bundle.mode === 'single') {
    await syncAdminPasswordKeysToStore(bundle.password);
    return;
  }
  await syncAdminPasswordKeysToStore(bundle.infra);
}

module.exports = {
  syncAdminPasswordKeysToStore,
  syncAdminKvFromPasswordBundle
};
