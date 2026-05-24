/**
 * Infrastructure admin-secrets.env generation (PG/Redis Commander defaults).
 *
 * @fileoverview Split from secrets.js for module size limits
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('./config');
const {
  mergeInfraParameterDefaultsForCli,
  getInfraParameterCatalog,
  readRelaxedCatalogDefaults
} = require('../parameters/infra-parameter-catalog');
const { createDefaultSecrets } = require('../utils/secrets-generator');
const pathsUtil = require('../utils/paths');
const { loadSecrets } = require('./secrets-load');
const { formatAdminEnvLine } = require('./admin-secrets');

/**
 * Writes admin env key-value pairs to content; encrypts values when encryption key is set.
 * @async
 * @param {Object.<string, string>} adminObj - Key-value object (e.g. POSTGRES_PASSWORD, ...)
 * @returns {Promise<string>} .env-style content (plaintext or secure:// for secrets)
 */
async function formatAdminSecretsContent(adminObj) {
  const encryptionKey = await config.getSecretsEncryptionKey();
  const { encryptSecret } = require('../utils/secrets-encryption');
  const lines = ['# Infrastructure Admin Credentials'];
  for (const [k, v] of Object.entries(adminObj)) {
    const value = (v === null || v === undefined) ? '' : String(v).replace(/\n/g, ' ').trim();
    const valueToWrite = encryptionKey ? encryptSecret(value, encryptionKey) : value;
    lines.push(formatAdminEnvLine(k, valueToWrite));
  }
  return lines.join('\n');
}

async function loadSecretsOrBootstrapForAdmin(secretsPath) {
  try {
    return await loadSecrets(secretsPath);
  } catch (error) {
    const defaultSecretsPath = secretsPath || path.join(pathsUtil.getAifabrixHome(), 'secrets.yaml');
    if (!fs.existsSync(defaultSecretsPath)) {
      logger.log('Creating default secrets file...');
      await createDefaultSecrets(defaultSecretsPath);
      return await loadSecrets(secretsPath);
    }
    throw error;
  }
}

function getInfraDefaultsMergedForAdmin() {
  try {
    return mergeInfraParameterDefaultsForCli(getInfraParameterCatalog().data, {});
  } catch {
    return {};
  }
}

function buildLocalAdminSecretsObject(secrets, infraDefaults) {
  const raw = secrets['postgres-passwordKeyVault'];
  const relaxed = readRelaxedCatalogDefaults();
  const postgresPassword =
    (raw && String(raw).trim()) ||
    infraDefaults.adminPassword ||
    relaxed.adminPassword ||
    '';
  const pgAdminEmail = infraDefaults.adminEmail || relaxed.adminEmail || '';
  return {
    POSTGRES_PASSWORD: postgresPassword,
    PGADMIN_DEFAULT_EMAIL: pgAdminEmail,
    PGADMIN_DEFAULT_PASSWORD: postgresPassword,
    REDIS_HOST: 'local:redis:6379:0:',
    REDIS_COMMANDER_USER: 'admin',
    REDIS_COMMANDER_PASSWORD: postgresPassword,
    KEYCLOAK_ADMIN_USERNAME: 'admin',
    KEYCLOAK_ADMIN_PASSWORD: postgresPassword,
    PLATFORM_ADMIN_PASSWORD: postgresPassword
  };
}

/** Generates admin secrets for infrastructure (beside config.yaml, typically ~/.aifabrix/admin-secrets.env). Defaults from infra.parameter.yaml `defaults`. */
async function generateAdminSecretsEnv(secretsPath) {
  const secrets = await loadSecretsOrBootstrapForAdmin(secretsPath);
  const infraDefaults = getInfraDefaultsMergedForAdmin();
  const adminObj = buildLocalAdminSecretsObject(secrets, infraDefaults);
  const aifabrixDir = pathsUtil.getAifabrixSystemDir();
  const adminEnvPath = path.join(aifabrixDir, 'admin-secrets.env');
  if (!fs.existsSync(aifabrixDir)) {
    fs.mkdirSync(aifabrixDir, { recursive: true, mode: 0o700 });
  }
  const adminSecrets = await formatAdminSecretsContent(adminObj);
  fs.writeFileSync(adminEnvPath, adminSecrets, { mode: 0o600 });
  return adminEnvPath;
}

module.exports = {
  formatAdminSecretsContent,
  generateAdminSecretsEnv
};
