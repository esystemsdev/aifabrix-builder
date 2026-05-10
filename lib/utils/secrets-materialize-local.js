/**
 * Persist resolved kv:// values into the primary user secrets file so regenerate (.env) stays stable.
 *
 * @fileoverview After env.template resolves, copy merged secret values into ~/.aifabrix/secrets.local.yaml
 * when keys are missing or empty locally **and** not already provided by the configured shared store
 * (`aifabrix-secrets` remote API or shared YAML), so shared-only keys are not duplicated into user secrets.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const logger = require('./logger');
const localSecretsModule = require('./local-secrets');
const secretsUtils = require('./secrets-utils');
const { loadConfiguredSharedSecretsStore } = require('./remote-secrets-loader');
const { decryptSecretsObject } = require('../core/secrets-load');
const { collectUniqueKvPathStrings } = require('./secrets-kv-refs');
const {
  resolveKvRefValue,
  mergeSecretsWithPrefixedCopies,
  isKvKeyAllowedEmptyWhenAbsent
} = require('./secrets-helpers');

/**
 * After successful kv resolution, write resolved values to the user secrets file when local slot is empty.
 * Does not overwrite non-empty local values (user wins).
 *
 * @async
 * @param {string} templateContent - Original env.template text (still contains kv:// refs)
 * @param {Object} mergedSecrets - Decrypted secrets map passed to resolveKvReferences (same as loadSecrets output)
 * @param {{ effective?: boolean, envKey?: string }|null} scopedKv - Scoped kv context from generateEnvContent
 * @param {Object} [options]
 * @param {boolean} [options.skipMaterializeKvToLocal] - Skip persistence (tests / programmatic)
 * @returns {Promise<string[]>} Keys materialized (written) to local file
 */
function buildScopedMaps(mergedSecrets, scopedKv) {
  const effective = Boolean(scopedKv && scopedKv.effective && scopedKv.envKey);
  const secretsMap = effective ? mergeSecretsWithPrefixedCopies(mergedSecrets, scopedKv.envKey) : mergedSecrets;
  const rawLocal = secretsUtils.loadPrimaryUserSecrets();
  const localMap = effective ? mergeSecretsWithPrefixedCopies(rawLocal, scopedKv.envKey) : rawLocal;
  return { effective, secretsMap, localMap };
}

function shouldSkipPersist(pathStr, resolvedVal, localVal) {
  if (resolvedVal === undefined || resolvedVal === null) return true;
  if (
    typeof resolvedVal === 'string' &&
    resolvedVal.trim() === '' &&
    isKvKeyAllowedEmptyWhenAbsent(pathStr)
  ) {
    return true;
  }
  if (localVal !== undefined && localVal !== null && String(localVal).trim() !== '') {
    return true;
  }
  return false;
}

function isNonEmptyResolvedKv(val) {
  if (val === undefined || val === null) return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  return true;
}

async function resolveSharedScopedMapForMaterialize(scopedKv, effective) {
  try {
    const rawShared = await loadConfiguredSharedSecretsStore();
    const decryptedShared = rawShared ? await decryptSecretsObject(rawShared) : null;
    if (!decryptedShared) return null;
    return effective && scopedKv && scopedKv.envKey
      ? mergeSecretsWithPrefixedCopies(decryptedShared, scopedKv.envKey)
      : decryptedShared;
  } catch {
    return null;
  }
}

function plaintextKvForLocalPersist(pathStr, secretsMap, localMap, sharedScoped, scopedKv, effective) {
  const resolvedVal = resolveKvRefValue(secretsMap, pathStr, scopedKv?.envKey, effective);
  const localVal = resolveKvRefValue(localMap, pathStr, scopedKv?.envKey, effective);
  if (shouldSkipPersist(pathStr, resolvedVal, localVal)) return null;
  const sharedVal =
    sharedScoped && typeof sharedScoped === 'object'
      ? resolveKvRefValue(sharedScoped, pathStr, scopedKv?.envKey, effective)
      : undefined;
  if (isNonEmptyResolvedKv(sharedVal)) return null;
  return typeof resolvedVal === 'string' ? resolvedVal : String(resolvedVal);
}

async function materializeResolvedKvSecretsToUserLocal(templateContent, mergedSecrets, scopedKv, options = {}) {
  if (
    !templateContent ||
    typeof templateContent !== 'string' ||
    options.skipMaterializeKvToLocal === true
  ) {
    return [];
  }

  try {
    const { effective, secretsMap, localMap } = buildScopedMaps(mergedSecrets, scopedKv);
    const sharedScoped = await resolveSharedScopedMapForMaterialize(scopedKv, effective);

    const paths = collectUniqueKvPathStrings(templateContent);
    const materialized = [];

    for (const pathStr of paths) {
      const plain = plaintextKvForLocalPersist(pathStr, secretsMap, localMap, sharedScoped, scopedKv, effective);
      if (plain === null) continue;
      await localSecretsModule.saveLocalSecret(pathStr, plain);
      materialized.push(pathStr);
    }

    if (materialized.length > 0) {
      logger.log(
        `✔ Saved ${materialized.length} resolved kv key(s) to local secrets for stable reinstalls: ${materialized.join(', ')}`
      );
    }

    return materialized;
  } catch (err) {
    if (typeof logger.warn === 'function') {
      logger.warn(`Could not materialize resolved kv secrets to local file: ${err.message}`);
    }
    return [];
  }
}

module.exports = {
  materializeResolvedKvSecretsToUserLocal
};
