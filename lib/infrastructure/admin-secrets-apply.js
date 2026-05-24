/**
 * Write admin-secrets.env from setup password bundles.
 *
 * @fileoverview Apply dev/pro bundles to admin-secrets.env
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fsRealSync = require('../internal/fs-real-sync');
const logger = require('../utils/logger');
const { applyPasswordBundleToAdminObj } = require('../core/admin-secrets-bundle');

const DEFAULT_ADMIN_OBJ = {
  REDIS_HOST: 'local:redis:6379:0:',
  REDIS_COMMANDER_USER: 'admin'
};

/**
 * @param {() => object} getCoreSecrets
 * @param {string} adminSecretsPath
 * @param {Object.<string, string>} merged
 * @param {string|null} logMessage
 */
async function writeAdminSecretsFile(getCoreSecrets, adminSecretsPath, merged, logMessage) {
  const { assertWritableSecretsPathForTests } = require('../utils/aifabrix-test-runtime-guard');
  assertWritableSecretsPathForTests(adminSecretsPath);
  const content = await getCoreSecrets().formatAdminSecretsContent(merged);
  fsRealSync.writeFileSync(adminSecretsPath, content, { mode: 0o600 });
  if (logMessage) {
    logger.log(logMessage);
  }
}

/**
 * @param {Object} ctx
 * @param {() => object} ctx.getCoreSecrets
 * @param {(bundle: object) => Promise<void>} [ctx.syncAdminKvFromPasswordBundle]
 * @param {boolean} [ctx.syncAdminKv]
 * @param {(dir: string) => void} ctx.logVolumeResetHint
 * @param {string} ctx.infraDirForHint
 * @param {string} ctx.adminSecretsPath
 * @param {Object} ctx.adminObj
 * @param {Object} ctx.bundle
 * @param {string} [ctx.email]
 */
async function applyAdminSecretsFromBundle(ctx) {
  const {
    getCoreSecrets,
    syncAdminKvFromPasswordBundle,
    syncAdminKv,
    logVolumeResetHint,
    infraDirForHint,
    adminSecretsPath,
    adminObj,
    bundle,
    email
  } = ctx;
  let merged = applyPasswordBundleToAdminObj({ ...DEFAULT_ADMIN_OBJ, ...adminObj }, bundle);
  if (email && String(email).trim()) {
    merged = { ...merged, PGADMIN_DEFAULT_EMAIL: String(email).trim() };
  }
  await writeAdminSecretsFile(
    getCoreSecrets,
    adminSecretsPath,
    merged,
    'Updated admin credentials in admin-secrets.env.'
  );
  if (syncAdminKv && typeof syncAdminKvFromPasswordBundle === 'function') {
    await syncAdminKvFromPasswordBundle(bundle);
  }
  logVolumeResetHint(infraDirForHint);
}

module.exports = {
  DEFAULT_ADMIN_OBJ,
  writeAdminSecretsFile,
  applyAdminSecretsFromBundle
};
