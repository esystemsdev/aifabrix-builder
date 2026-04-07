/**
 * Infra catalog helpers for secrets-ensure (placeholder context, empty-allowed keys, up-infra key list).
 * @fileoverview Split from secrets-ensure.js for max-lines compliance
 */
'use strict';

const path = require('path');
const logger = require('../utils/logger');
const pathsUtil = require('../utils/paths');
const { getAllInfraEnsureKeys } = require('../parameters/infra-kv-discovery');

/** Shipped infra.parameter.yaml (matches infra-parameter-catalog DEFAULT_CATALOG_PATH). Local join so partial Jest mocks cannot omit DEFAULT_CATALOG_PATH. */
const BUNDLED_INFRA_PARAMETER_YAML = path.join(__dirname, '..', 'schema', 'infra.parameter.yaml');

/**
 * Lazy require so Jest mocks of infra-parameter-catalog apply when this module loads after mocks.
 * @returns {typeof import('../parameters/infra-parameter-catalog')}
 */
function infraParameterCatalogModule() {
  return require('../parameters/infra-parameter-catalog');
}

/**
 * Merge infra.parameter.yaml defaults with up-infra CLI options for {{placeholder}} expansion.
 * @param {Object} [options]
 * @returns {Record<string, string>}
 */
function buildInfraPlaceholderContext(options) {
  const cat = infraParameterCatalogModule();
  try {
    return cat.mergeInfraParameterDefaultsForCli(cat.getInfraParameterCatalog().data, options || {});
  } catch {
    return cat.mergeInfraParameterDefaultsForCli({}, options || {});
  }
}

/**
 * Keys that may stay empty without backfill (catalog generator emptyAllowed).
 * @param {string} key - Secret key
 * @returns {boolean}
 */
function isSecretKeyAllowedEmpty(key) {
  const cat = infraParameterCatalogModule();
  try {
    return cat.getInfraParameterCatalog().isKeyAllowedEmpty(key);
  } catch {
    const emptyAllowed = cat.readRelaxedEmptyAllowedKeySet(BUNDLED_INFRA_PARAMETER_YAML);
    return Boolean(emptyAllowed && emptyAllowed.has(key));
  }
}

/**
 * Infra secret keys for up-infra: catalog (ensureOn upInfra) + workspace DB/template discovery
 * + standard miso-controller multi-DB keys.
 * @returns {string[]}
 */
function getInfraSecretKeysForUpInfra() {
  const cat = infraParameterCatalogModule();
  try {
    const catalog = cat.getInfraParameterCatalog();
    return getAllInfraEnsureKeys(catalog, pathsUtil);
  } catch (err) {
    logger.warn(`Could not build infra secret key list from catalog (${err.message}); using relaxed YAML read.`);
    const relaxed = cat.readRelaxedUpInfraEnsureKeyList(BUNDLED_INFRA_PARAMETER_YAML);
    if (relaxed && relaxed.length > 0) {
      return relaxed;
    }
    logger.warn('Relaxed read of infra.parameter.yaml produced no keys; up-infra may skip secret backfill.');
    return [];
  }
}

module.exports = {
  buildInfraPlaceholderContext,
  isSecretKeyAllowedEmpty,
  getInfraSecretKeysForUpInfra
};
