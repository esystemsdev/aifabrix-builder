/**
 * @fileoverview Sync secrets store with up-infra CLI placeholder overrides (catalog-driven).
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const logger = require('../utils/logger');

/**
 * When CLI passes --adminPassword, --userPassword, or --adminEmail, overwrite every catalog literal
 * that embeds the matching {{placeholder}}. ensureSecretsForKeys only backfills missing keys; this
 * keeps the store aligned with explicit CLI overrides (keys come from infra.parameter.yaml).
 *
 * @param {Object} options - Same flags as ensureInfraSecrets
 * @param {Record<string, string>} placeholderContext - Merged catalog defaults + CLI
 * @param {(key: string, value: string) => Promise<void>} setSecretInStore
 * @param {() => typeof import('../parameters/infra-parameter-catalog')} getCatalogModule - Lazy catalog require
 * @returns {Promise<void>}
 */
async function syncLiteralKvSecretsFromCliOverrides(
  options,
  placeholderContext,
  setSecretInStore,
  getCatalogModule
) {
  const crypto = require('crypto');
  const ipc = getCatalogModule();
  let catalog;
  try {
    catalog = ipc.getInfraParameterCatalog();
  } catch {
    return;
  }

  const runOne = async(placeholder, cliValue) => {
    const trimmed = String(cliValue || '').trim();
    if (!trimmed) return;
    const keys = ipc.listKvKeysWithLiteralPlaceholder(catalog, placeholder);
    if (keys.length === 0) return;
    for (const key of keys) {
      const entry = catalog.findEntryForKey(key);
      if (!entry) continue;
      const val = ipc.generateValueFromCatalogEntry(key, entry, crypto, placeholderContext);
      await setSecretInStore(key, val);
    }
    logger.log(
      `Updated ${keys.length} secret(s) in store (catalog literals using {{${placeholder}}}).`
    );
  };

  await runOne(
    'adminPassword',
    options.adminPassword || options.adminPwd || ''
  );
  await runOne('userPassword', options.userPassword || '');
  await runOne('adminEmail', options.adminEmail || '');
}

module.exports = {
  syncLiteralKvSecretsFromCliOverrides
};
