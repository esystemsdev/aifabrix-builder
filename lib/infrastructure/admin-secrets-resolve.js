/**
 * Resolve admin password/email for ensureAdminSecrets from CLI and catalog defaults.
 *
 * @fileoverview CLI + catalog resolution for admin-secrets.env
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const {
  mergeInfraParameterDefaultsForCli,
  getInfraParameterCatalog,
  readRelaxedCatalogDefaults
} = require('../parameters/infra-parameter-catalog');

/**
 * @param {Object} options
 * @returns {Object}
 */
function loadAdminMergedDefaultsForInfra(options) {
  try {
    return mergeInfraParameterDefaultsForCli(getInfraParameterCatalog().data, options);
  } catch {
    return mergeInfraParameterDefaultsForCli({}, options);
  }
}

/**
 * @param {Object} options
 * @param {Object} mergedDefaults
 * @returns {{ adminPwdOverride: string|null, passwordToUse: string, emailOverride: string|null, emailToUse: string }}
 */
function resolveAdminPasswordAndEmailCli(options, mergedDefaults) {
  const infraDefaults = readRelaxedCatalogDefaults();
  const adminPwdCli = String(options.adminPassword || options.adminPwd || '').trim();
  const adminPwdOverride = adminPwdCli !== '' ? adminPwdCli : null;
  const passwordToUse =
    adminPwdOverride !== null
      ? adminPwdOverride
      : mergedDefaults.adminPassword || infraDefaults.adminPassword || '';
  const emailCli = String(options.adminEmail || '').trim();
  const emailOverride = emailCli !== '' ? emailCli : null;
  const emailToUse =
    emailOverride !== null
      ? emailOverride
      : mergedDefaults.adminEmail || infraDefaults.adminEmail || '';
  return { adminPwdOverride, passwordToUse, emailOverride, emailToUse };
}

/**
 * @param {Object} adminObj
 * @returns {{ needsPasswordBackfill: boolean, needsEmailBackfill: boolean }}
 */
function computeAdminSecretsBackfillFlags(adminObj) {
  const needsPasswordBackfill =
    !(adminObj.POSTGRES_PASSWORD && adminObj.POSTGRES_PASSWORD.trim()) ||
    !(adminObj.PGADMIN_DEFAULT_PASSWORD && adminObj.PGADMIN_DEFAULT_PASSWORD.trim()) ||
    !(adminObj.REDIS_COMMANDER_PASSWORD && adminObj.REDIS_COMMANDER_PASSWORD.trim());
  const needsEmailBackfill = !(adminObj.PGADMIN_DEFAULT_EMAIL && adminObj.PGADMIN_DEFAULT_EMAIL.trim());
  return { needsPasswordBackfill, needsEmailBackfill };
}

/**
 * @param {boolean} shouldOverwriteWithAdminPwd
 * @param {boolean} needsPasswordBackfill
 * @param {string} passwordToUse
 * @param {Object} adminObj
 * @param {Object} mergedDefaults
 * @returns {string}
 */
function resolvePasswordForAdminFile(
  shouldOverwriteWithAdminPwd,
  needsPasswordBackfill,
  passwordToUse,
  adminObj,
  mergedDefaults
) {
  if (shouldOverwriteWithAdminPwd || needsPasswordBackfill) {
    return passwordToUse;
  }
  return (
    String(adminObj.POSTGRES_PASSWORD || '').trim() ||
    mergedDefaults.adminPassword ||
    readRelaxedCatalogDefaults().adminPassword ||
    ''
  );
}

module.exports = {
  loadAdminMergedDefaultsForInfra,
  resolveAdminPasswordAndEmailCli,
  computeAdminSecretsBackfillFlags,
  resolvePasswordForAdminFile
};
