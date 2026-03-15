/**
 * AI Fabrix Builder Infrastructure Helpers
 *
 * Helper functions for infrastructure management including directory names,
 * Docker availability checks, and pgAdmin configuration.
 *
 * @fileoverview Helper functions for infrastructure management
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const handlebars = require('handlebars');
const secrets = require('../core/secrets');
const adminSecrets = require('../core/admin-secrets');
const logger = require('../utils/logger');
const dockerUtils = require('../utils/docker');
const paths = require('../utils/paths');
const secretsEnsure = require('../core/secrets-ensure');

/**
 * Gets infrastructure directory name based on developer ID
 * Dev 0: infra (no dev-0 suffix), Dev > 0: infra-dev{id}
 * @param {number|string} devId - Developer ID
 * @returns {string} Infrastructure directory name
 */
function getInfraDirName(devId) {
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  return idNum === 0 ? 'infra' : `infra-dev${devId}`;
}

/**
 * Gets Docker Compose project name based on developer ID
 * Dev 0: infra (no dev-0 suffix), Dev > 0: infra-dev{id}
 * @param {number|string} devId - Developer ID
 * @returns {string} Docker Compose project name
 */
function getInfraProjectName(devId) {
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  return idNum === 0 ? 'infra' : `infra-dev${devId}`;
}

/**
 * Check Docker availability
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If Docker is not available
 */
async function checkDockerAvailability() {
  try {
    await dockerUtils.ensureDockerAndCompose();
  } catch (error) {
    throw new Error('Docker or Docker Compose is not available. Please install and start Docker.');
  }
}

/** Default admin password for new local installations when admin-secrets.env is empty */
const DEFAULT_ADMIN_PASSWORD = 'admin123';

/**
 * Log hint to reset Postgres volume when admin password was changed after first init.
 * @param {string} infraDir - Path to infra directory
 */
function logVolumeResetHint(infraDir) {
  logger.log(chalk.yellow(
    'If Postgres was already started with a different password, login will fail until you reset the volume. ' +
    `Run: cd ${infraDir} && docker compose -f compose.yaml -p aifabrix down -v , then run 'aifabrix up-infra --adminPwd <password>' again.`
  ));
}

/**
 * Sync postgres-passwordKeyVault to the main secrets store (file or remote).
 * @param {string} password - Password to store
 */
async function syncPostgresPasswordToStore(password) {
  try {
    await secretsEnsure.setSecretInStore('postgres-passwordKeyVault', password);
  } catch (err) {
    logger.warn(`Could not sync postgres-passwordKeyVault to secrets store: ${err.message}`);
  }
}

/** Default admin env keys and values when missing. */
const DEFAULT_ADMIN_OBJ = {
  PGADMIN_DEFAULT_EMAIL: 'admin@aifabrix.dev',
  REDIS_HOST: 'local:redis:6379:0:',
  REDIS_COMMANDER_USER: 'admin'
};

/**
 * Writes merged admin secrets to disk and logs/syncs as needed.
 * @async
 * @param {string} adminSecretsPath - Path to admin-secrets.env
 * @param {Object} adminObj - Decrypted admin secrets object
 * @param {string} passwordToUse - Password to set for Postgres, pgAdmin, Redis Commander
 * @param {boolean} shouldOverwriteWithAdminPwd - Whether this was an explicit admin password update
 */
async function applyAdminSecretsUpdate(adminSecretsPath, adminObj, passwordToUse, shouldOverwriteWithAdminPwd) {
  const merged = { ...DEFAULT_ADMIN_OBJ, ...adminObj };
  merged.POSTGRES_PASSWORD = passwordToUse;
  merged.PGADMIN_DEFAULT_PASSWORD = passwordToUse;
  merged.REDIS_COMMANDER_PASSWORD = passwordToUse;
  const content = await secrets.formatAdminSecretsContent(merged);
  fs.writeFileSync(adminSecretsPath, content, { mode: 0o600 });
  if (shouldOverwriteWithAdminPwd) {
    logger.log('Updated admin password in admin-secrets.env.');
    await syncPostgresPasswordToStore(passwordToUse);
    logVolumeResetHint(path.join(paths.getAifabrixHome(), getInfraDirName(0)));
  } else {
    logger.log('Set default admin password in admin-secrets.env for local use.');
  }
}

/**
 * Ensure admin secrets file exists and set admin password.
 * When adminPwd is provided, update POSTGRES_PASSWORD, PGADMIN_DEFAULT_PASSWORD, REDIS_COMMANDER_PASSWORD
 * in admin-secrets.env (overwrites existing values). Otherwise only backfill empty fields.
 * Reads and writes using decrypted values; writes encrypted when secrets-encryption key is set.
 *
 * @async
 * @param {Object} [options] - Options
 * @param {string} [options.adminPwd] - Override admin password for Postgres, pgAdmin, Redis Commander (updates file when provided)
 * @returns {Promise<string>} Path to admin secrets file
 */
async function ensureAdminSecrets(options = {}) {
  const adminPwdOverride = options.adminPwd && typeof options.adminPwd === 'string' && options.adminPwd.trim() !== ''
    ? options.adminPwd.trim()
    : null;
  const passwordToUse = adminPwdOverride || DEFAULT_ADMIN_PASSWORD;
  const adminSecretsPath = path.join(paths.getAifabrixHome(), 'admin-secrets.env');

  if (!fs.existsSync(adminSecretsPath)) {
    logger.log('Generating admin-secrets.env...');
    await secrets.generateAdminSecretsEnv(undefined);
    return adminSecretsPath;
  }

  const adminObj = await adminSecrets.readAndDecryptAdminSecrets(adminSecretsPath);
  const needsBackfill = !(adminObj.POSTGRES_PASSWORD && adminObj.POSTGRES_PASSWORD.trim()) ||
    !(adminObj.PGADMIN_DEFAULT_PASSWORD && adminObj.PGADMIN_DEFAULT_PASSWORD.trim()) ||
    !(adminObj.REDIS_COMMANDER_PASSWORD && adminObj.REDIS_COMMANDER_PASSWORD.trim());
  const shouldOverwriteWithAdminPwd = adminPwdOverride !== null;

  if (!shouldOverwriteWithAdminPwd && !needsBackfill) {
    return adminSecretsPath;
  }

  await applyAdminSecretsUpdate(adminSecretsPath, adminObj, passwordToUse, shouldOverwriteWithAdminPwd);
  return adminSecretsPath;
}

/**
 * Generates pgAdmin4 servers.json only. pgpass is not written to disk (ISO 27K);
 * it is created temporarily in startDockerServicesAndConfigure and deleted after copy to container.
 *
 * @param {string} infraDir - Infrastructure directory path
 * @param {string} postgresPassword - PostgreSQL password (for servers.json PassFile reference only; password not stored in file)
 */
function generatePgAdminConfig(infraDir, postgresPassword) {
  const serversJsonTemplatePath = path.join(__dirname, '..', '..', 'templates', 'infra', 'servers.json.hbs');
  if (!fs.existsSync(serversJsonTemplatePath)) {
    return;
  }

  const serversJsonTemplateContent = fs.readFileSync(serversJsonTemplatePath, 'utf8');
  const serversJsonTemplate = handlebars.compile(serversJsonTemplateContent);
  const serversJsonContent = serversJsonTemplate({ postgresPassword });
  const serversJsonPath = path.join(infraDir, 'servers.json');
  fs.writeFileSync(serversJsonPath, serversJsonContent, { mode: 0o644 });
}

/**
 * Escape single quotes for use in PostgreSQL string literal (double each single quote)
 * @param {string} s - Raw string
 * @returns {string} Escaped string
 */
function escapePgString(s) {
  if (s === null || s === undefined || typeof s !== 'string') return '';
  return s.replace(/'/g, '\'\'');
}

/**
 * Extract password from a URL string or plain password value
 * @param {string} urlOrPassword - URL (with ://) or plain password
 * @returns {string|null} Extracted password or null to keep default
 */
function extractPasswordFromUrlOrValue(urlOrPassword) {
  if (typeof urlOrPassword !== 'string' || urlOrPassword.length === 0) return null;
  if (!urlOrPassword.includes('://')) return urlOrPassword;
  try {
    const u = new URL(urlOrPassword.replace(/\$\{DB_HOST\}/g, 'postgres').replace(/\$\{DB_PORT\}/g, '5432'));
    return u.password || null;
  } catch {
    return null;
  }
}

/**
 * Ensures Postgres init script exists for miso-controller app (database miso, user miso_user).
 * Reads password from configured store (file or remote). Fails with clear message if secret is missing.
 * Run ensureInfraSecrets before startInfra so databases-miso-controller-0-passwordKeyVault exists.
 *
 * @async
 * @param {string} infraDir - Infrastructure directory path
 * @returns {Promise<void>}
 */
async function ensureMisoInitScript(infraDir) {
  const initScriptsDir = path.join(infraDir, 'init-scripts');
  if (!fs.existsSync(initScriptsDir)) {
    fs.mkdirSync(initScriptsDir, { recursive: true });
  }

  const secretKey = 'databases-miso-controller-0-passwordKeyVault';
  let password;
  try {
    const loaded = await secrets.loadSecrets(undefined);
    const urlOrPassword = loaded[secretKey] || loaded['databases-miso-controller-0-urlKeyVault'];
    const extracted = extractPasswordFromUrlOrValue(urlOrPassword);
    if (extracted !== null && extracted.trim() !== '') {
      password = extracted;
    }
  } catch (err) {
    throw new Error(
      `Secret ${secretKey} not found or could not load secrets. Run "aifabrix up-infra" to ensure infra secrets, or add it to your secrets file. ${err.message}`
    );
  }
  if (!password || password.trim() === '') {
    throw new Error(
      `Secret ${secretKey} is missing or empty. Run "aifabrix up-infra" to ensure infra secrets, or add it to your secrets file.`
    );
  }

  const passwordEscaped = escapePgString(password);

  const sh = `#!/bin/bash
set -e
# Miso-controller app database and user (matches DATABASE_URL in env)
# Runs on first Postgres volume init only
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<EOSQL
DO \\$\\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'miso_user') THEN
    CREATE USER miso_user WITH PASSWORD '${passwordEscaped}';
  ELSE
    ALTER USER miso_user WITH PASSWORD '${passwordEscaped}';
  END IF;
END
\\$\\$;
EOSQL
if ! psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_database WHERE datname = 'miso'" | grep -q 1; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE miso OWNER miso_user;"
fi
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "miso" -c "GRANT ALL ON SCHEMA public TO miso_user; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO miso_user;"
`;
  const initPath = path.join(initScriptsDir, '02-miso-app.sh');
  fs.writeFileSync(initPath, sh, { mode: 0o755 });
}

/**
 * Prepare infrastructure directory and extract postgres password from decrypted admin secrets.
 * @async
 * @param {string} devId - Developer ID
 * @param {string} adminSecretsPath - Path to admin secrets file
 * @returns {Promise<Object>} Object with infraDir and postgresPassword
 */
async function prepareInfraDirectory(devId, adminSecretsPath) {
  const aifabrixDir = paths.getAifabrixHome();
  const infraDirName = getInfraDirName(devId);
  const infraDir = path.join(aifabrixDir, infraDirName);
  if (!fs.existsSync(infraDir)) {
    fs.mkdirSync(infraDir, { recursive: true });
  }

  const oldPgpassPath = path.join(infraDir, 'pgpass');
  if (fs.existsSync(oldPgpassPath)) {
    try {
      fs.unlinkSync(oldPgpassPath);
    } catch {
      // Ignore
    }
  }

  const adminObj = await adminSecrets.readAndDecryptAdminSecrets(adminSecretsPath);
  const postgresPassword = (adminObj.POSTGRES_PASSWORD && adminObj.POSTGRES_PASSWORD.trim()) || DEFAULT_ADMIN_PASSWORD;
  generatePgAdminConfig(infraDir, postgresPassword);

  return { infraDir, postgresPassword };
}

/**
 * Register Handlebars helper for equality comparison
 */
function registerHandlebarsHelper() {
  handlebars.registerHelper('eq', (a, b) => {
    // Handle null/undefined - treat as "0" for default infrastructure
    if (a === null || a === undefined) a = '0';
    if (b === null || b === undefined) b = '0';
    const aNum = typeof a === 'string' && /^\d+$/.test(a) ? parseInt(a, 10) : a;
    const bNum = typeof b === 'string' && /^\d+$/.test(b) ? parseInt(b, 10) : b;
    if (typeof aNum === 'number' && typeof bNum === 'number') {
      return aNum === bNum;
    }
    return a === b;
  });
}

module.exports = {
  getInfraDirName,
  getInfraProjectName,
  checkDockerAvailability,
  ensureAdminSecrets,
  generatePgAdminConfig,
  prepareInfraDirectory,
  ensureMisoInitScript,
  registerHandlebarsHelper
};
