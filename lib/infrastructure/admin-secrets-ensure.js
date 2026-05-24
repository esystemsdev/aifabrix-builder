/**
 * Ensure `admin-secrets.env` exists and reflects CLI / setup password bundles.
 *
 * @fileoverview ensureAdminSecrets for up-infra and setup
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const fsRealSync = require('../internal/fs-real-sync');
const adminSecrets = require('../core/admin-secrets');
const logger = require('../utils/logger');
const paths = require('../utils/paths');
const {
  loadAdminMergedDefaultsForInfra,
  resolveAdminPasswordAndEmailCli,
  computeAdminSecretsBackfillFlags,
  resolvePasswordForAdminFile
} = require('./admin-secrets-resolve');
const { syncAdminKvFromPasswordBundle, syncRequiredKvFromPasswordBundle } = require('./admin-secrets-sync');
const { applyAdminSecretsFromBundle: applyAdminSecretsFromBundleImpl } = require('./admin-secrets-apply');

/**
 * @param {() => object} getCoreSecrets
 * @param {(devId: number|string) => string} getInfraDirName
 * @param {(infraDir: string) => void} logVolumeResetHint
 * @param {Function} applyAdminSecretsUpdate
 * @param {Object} [options]
 * @returns {Promise<string>}
 */
async function ensureAdminSecrets(
  getCoreSecrets,
  getInfraDirName,
  logVolumeResetHint,
  applyAdminSecretsUpdate,
  options = {}
) {
  const { passwordBundleFromCliOptions } = require('../core/admin-secrets-bundle');
  const bundle = options.passwordBundle || passwordBundleFromCliOptions(options);
  const mergedDefaults = loadAdminMergedDefaultsForInfra(options);
  const { adminPwdOverride, passwordToUse, emailOverride, emailToUse } = resolveAdminPasswordAndEmailCli(
    options,
    mergedDefaults
  );
  const adminSecretsPath = path.join(paths.getAifabrixSystemDir(), 'admin-secrets.env');

  if (!fsRealSync.existsSync(adminSecretsPath)) {
    logger.log('Generating admin-secrets.env...');
    await getCoreSecrets().generateAdminSecretsEnv(undefined);
  }

  if (bundle) {
    const adminObj = await adminSecrets.readAndDecryptAdminSecrets(adminSecretsPath);
    await applyAdminSecretsFromBundleImpl({
      getCoreSecrets,
      syncAdminKvFromPasswordBundle,
      syncRequiredKvFromPasswordBundle,
      syncAdminKv: options.syncAdminKv === true,
      logVolumeResetHint,
      infraDirForHint: path.join(paths.getAifabrixSystemDir(), getInfraDirName(0)),
      adminSecretsPath,
      adminObj,
      bundle,
      email: emailToUse
    });
    return adminSecretsPath;
  }

  const adminObj = await adminSecrets.readAndDecryptAdminSecrets(adminSecretsPath);
  return applyLegacyAdminSecretsUpdate(
    applyAdminSecretsUpdate,
    adminSecretsPath,
    adminObj,
    {
      adminPwdOverride,
      passwordToUse,
      emailOverride,
      emailToUse,
      mergedDefaults,
      syncAdminKv: options.syncAdminKv === true
    }
  );
}

/**
 * @param {Function} applyAdminSecretsUpdate
 * @param {string} adminSecretsPath
 * @param {Object} adminObj
 * @param {Object} ctx
 * @returns {Promise<string>}
 */
async function applyLegacyAdminSecretsUpdate(
  applyAdminSecretsUpdate,
  adminSecretsPath,
  adminObj,
  ctx
) {
  const { needsPasswordBackfill, needsEmailBackfill } = computeAdminSecretsBackfillFlags(adminObj);
  const shouldOverwriteWithAdminPwd = ctx.adminPwdOverride !== null;
  const shouldOverwriteEmail = ctx.emailOverride !== null;
  const updateEmail = shouldOverwriteEmail || needsEmailBackfill;

  if (!shouldOverwriteWithAdminPwd && !needsPasswordBackfill && !updateEmail) {
    return adminSecretsPath;
  }

  const passwordForFile = resolvePasswordForAdminFile(
    shouldOverwriteWithAdminPwd,
    needsPasswordBackfill,
    ctx.passwordToUse,
    adminObj,
    ctx.mergedDefaults
  );

  await applyAdminSecretsUpdate(
    adminSecretsPath,
    adminObj,
    passwordForFile,
    shouldOverwriteWithAdminPwd,
    { updateEmail, emailToUse: ctx.emailToUse },
    ctx.syncAdminKv === true
  );
  return adminSecretsPath;
}

module.exports = {
  ensureAdminSecrets
};
