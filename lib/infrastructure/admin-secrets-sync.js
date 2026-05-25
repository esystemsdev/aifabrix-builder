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
 * Keep kv:// secrets aligned with admin-secrets for platform install (required for pro split bundles).
 * @param {Object|null} bundle
 * @returns {Promise<void>}
 */
async function syncRequiredKvFromPasswordBundle(bundle) {
  if (!bundle) return;
  const { syncLiteralKvSecretsFromCliOverrides } = require('../core/secrets-infra-placeholder-sync');
  const { buildInfraPlaceholderContext } = require('../core/secrets-ensure');
  const ipc = require('../parameters/infra-parameter-catalog');

  if (bundle.mode === 'single') {
    const pwd = bundle.password;
    await secretsEnsure.setSecretInStore('keycloak-admin-passwordKeyVault', pwd);
    const ctx = buildInfraPlaceholderContext({ userPassword: pwd });
    await syncLiteralKvSecretsFromCliOverrides(
      { userPassword: pwd },
      ctx,
      (key, val) => secretsEnsure.setSecretInStore(key, val),
      () => ipc
    );
    return;
  }

  await secretsEnsure.setSecretInStore('keycloak-admin-passwordKeyVault', bundle.keycloak);
  const userCtx = buildInfraPlaceholderContext({ userPassword: bundle.platform });
  await syncLiteralKvSecretsFromCliOverrides(
    { userPassword: bundle.platform },
    userCtx,
    (key, val) => secretsEnsure.setSecretInStore(key, val),
    () => ipc
  );
}

/**
 * @param {Object|null} bundle
 * @returns {Promise<void>}
 */
async function syncAdminKvFromPasswordBundle(bundle) {
  await syncRequiredKvFromPasswordBundle(bundle);
  if (bundle.mode === 'single') {
    await syncAdminPasswordKeysToStore(bundle.password);
  } else {
    await syncAdminPasswordKeysToStore(bundle.infra);
  }
}

module.exports = {
  syncAdminPasswordKeysToStore,
  syncRequiredKvFromPasswordBundle,
  syncAdminKvFromPasswordBundle
};
