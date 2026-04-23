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
const fsRealSync = require('../internal/fs-real-sync');
const { nodeFs } = require('../internal/node-fs');
const chalk = require('chalk');
const handlebars = require('handlebars');
const adminSecrets = require('../core/admin-secrets');
const logger = require('../utils/logger');
const paths = require('../utils/paths');
const secretsEnsure = require('../core/secrets-ensure');
const {
  mergeInfraParameterDefaultsForCli,
  getInfraParameterCatalog,
  readRelaxedCatalogDefaults
} = require('../parameters/infra-parameter-catalog');
const { checkDockerAvailability } = require('./helpers-docker-check');

/**
 * Lazy-load core/secrets at call time. A top-level require creates a circular dependency:
 * secrets → url-declarative-resolve → compose-generator → compose-generate-docker-compose → this module,
 * which left `generateAdminSecretsEnv` / `formatAdminSecretsContent` undefined on the captured export.
 * @returns {Object} core/secrets module exports (loadSecrets, generateAdminSecretsEnv, …)
 */
function getCoreSecrets() {
  return require('../core/secrets');
}

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
 * Fallback for admin password/email when validated catalog load failed but YAML is still readable.
 * @returns {Record<string, string>}
 */
function readInfraDefaultScalars() {
  return readRelaxedCatalogDefaults();
}

/**
 * Log hint to reset Postgres volume when admin password was changed after first init.
 * @param {string} infraDir - Path to infra directory
 */
function logVolumeResetHint(infraDir) {
  logger.log(chalk.yellow(
    'If Postgres was already started with a different password, login will fail until you reset the volume. ' +
    `Run: cd ${infraDir} && docker compose -f compose.yaml -p aifabrix down -v , then run 'aifabrix up-infra --adminPassword <password>' again.`
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

/** Non-email defaults for admin-secrets.env merge (email default comes from infra.parameter.yaml `defaults`). */
const DEFAULT_ADMIN_OBJ = {
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
 * @param {{ updateEmail?: boolean, emailToUse?: string }} [emailOpts]
 */
async function applyAdminSecretsUpdate(
  adminSecretsPath,
  adminObj,
  passwordToUse,
  shouldOverwriteWithAdminPwd,
  emailOpts
) {
  const merged = { ...DEFAULT_ADMIN_OBJ, ...adminObj };
  merged.POSTGRES_PASSWORD = passwordToUse;
  merged.PGADMIN_DEFAULT_PASSWORD = passwordToUse;
  merged.REDIS_COMMANDER_PASSWORD = passwordToUse;
  if (emailOpts && emailOpts.updateEmail && emailOpts.emailToUse) {
    merged.PGADMIN_DEFAULT_EMAIL = emailOpts.emailToUse;
  }
  const content = await getCoreSecrets().formatAdminSecretsContent(merged);
  fsRealSync.writeFileSync(adminSecretsPath, content, { mode: 0o600 });
  if (shouldOverwriteWithAdminPwd) {
    logger.log('Updated admin password in admin-secrets.env.');
    await syncPostgresPasswordToStore(passwordToUse);
    logVolumeResetHint(path.join(paths.getAifabrixSystemDir(), getInfraDirName(0)));
  } else if (emailOpts && emailOpts.updateEmail) {
    logger.log('Updated admin email in admin-secrets.env.');
  } else {
    logger.log('Set default admin password in admin-secrets.env for local use.');
  }
}

function loadAdminMergedDefaultsForInfra(options) {
  try {
    return mergeInfraParameterDefaultsForCli(getInfraParameterCatalog().data, options);
  } catch {
    return mergeInfraParameterDefaultsForCli({}, options);
  }
}

function resolveAdminPasswordAndEmailCli(options, mergedDefaults) {
  const infraDefaults = readInfraDefaultScalars();
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

function computeAdminSecretsBackfillFlags(adminObj) {
  const needsPasswordBackfill =
    !(adminObj.POSTGRES_PASSWORD && adminObj.POSTGRES_PASSWORD.trim()) ||
    !(adminObj.PGADMIN_DEFAULT_PASSWORD && adminObj.PGADMIN_DEFAULT_PASSWORD.trim()) ||
    !(adminObj.REDIS_COMMANDER_PASSWORD && adminObj.REDIS_COMMANDER_PASSWORD.trim());
  const needsEmailBackfill = !(adminObj.PGADMIN_DEFAULT_EMAIL && adminObj.PGADMIN_DEFAULT_EMAIL.trim());
  return { needsPasswordBackfill, needsEmailBackfill };
}

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
    readInfraDefaultScalars().adminPassword ||
    ''
  );
}

/**
 * Ensure admin secrets file exists and set admin password.
 * When adminPwd is provided, update POSTGRES_PASSWORD, PGADMIN_DEFAULT_PASSWORD, REDIS_COMMANDER_PASSWORD
 * in admin-secrets.env (overwrites existing values). Otherwise only backfill empty fields.
 * Reads and writes using decrypted values; writes encrypted when secrets-encryption key is set.
 *
 * @async
 * @param {Object} [options] - Options
 * @param {string} [options.adminPassword] - Override admin password (alias: adminPwd)
 * @param {string} [options.adminPwd] - Override admin password for Postgres, pgAdmin, Redis Commander
 * @param {string} [options.adminEmail] - Override pgAdmin default email (matches {{adminEmail}} defaults)
 * @param {string} [options.userPassword] - Reserved for Keycloak user template (secrets use ensureInfraSecrets)
 * @returns {Promise<string>} Path to admin secrets file
 */
async function ensureAdminSecrets(options = {}) {
  const mergedDefaults = loadAdminMergedDefaultsForInfra(options);
  const { adminPwdOverride, passwordToUse, emailOverride, emailToUse } = resolveAdminPasswordAndEmailCli(
    options,
    mergedDefaults
  );
  const adminSecretsPath = path.join(paths.getAifabrixSystemDir(), 'admin-secrets.env');

  if (!fsRealSync.existsSync(adminSecretsPath)) {
    logger.log('Generating admin-secrets.env...');
    await getCoreSecrets().generateAdminSecretsEnv(undefined);
    return adminSecretsPath;
  }

  const adminObj = await adminSecrets.readAndDecryptAdminSecrets(adminSecretsPath);
  const { needsPasswordBackfill, needsEmailBackfill } = computeAdminSecretsBackfillFlags(adminObj);
  const shouldOverwriteWithAdminPwd = adminPwdOverride !== null;
  const shouldOverwriteEmail = emailOverride !== null;
  const updateEmail = shouldOverwriteEmail || needsEmailBackfill;

  if (!shouldOverwriteWithAdminPwd && !needsPasswordBackfill && !updateEmail) {
    return adminSecretsPath;
  }

  const passwordForFile = resolvePasswordForAdminFile(
    shouldOverwriteWithAdminPwd,
    needsPasswordBackfill,
    passwordToUse,
    adminObj,
    mergedDefaults
  );

  await applyAdminSecretsUpdate(adminSecretsPath, adminObj, passwordForFile, shouldOverwriteWithAdminPwd, {
    updateEmail,
    emailToUse
  });
  return adminSecretsPath;
}

/** Host-side pgpass for pgAdmin bind mount (must exist before container starts so servers.json import succeeds). */
const PGPASS_BOOTSTRAP_BASENAME = '.pgpass.bootstrap';

/**
 * Writes pgpass next to servers.json for Docker bind mount into /pgadmin4 (not under /var/lib/pgadmin volume).
 * Prefer chown to pgAdmin UID so mode 600 is readable in the container; fall back to 644 if not root.
 *
 * @param {string} infraDir - Infrastructure directory path
 * @param {string} postgresPassword - PostgreSQL password for the pgpass line
 */
function writePgpassBootstrap(infraDir, postgresPassword) {
  const line = `postgres:5432:postgres:pgadmin:${postgresPassword}\n`;
  const dest = path.join(infraDir, PGPASS_BOOTSTRAP_BASENAME);
  fs.writeFileSync(dest, line, { mode: 0o600 });
  try {
    fs.chownSync(dest, 5050, 5050);
  } catch {
    try {
      fs.chmodSync(dest, 0o644);
    } catch {
      // Ignore — container may still read depending on daemon / user namespace
    }
  }
}

/**
 * Generates pgAdmin4 servers.json only. pgpass for the container is supplied via bind-mounted
 * `.pgpass.bootstrap` (written by writePgpassBootstrap); not embedded in servers.json.
 *
 * @param {string} infraDir - Infrastructure directory path
 * @param {string} postgresPassword - Used only for consistency / future template fields (password is not written into servers.json)
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
    const loaded = await getCoreSecrets().loadSecrets(undefined);
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
 * @param {{ pgpassBootstrap?: boolean }} [prepOptions] - When pgpassBootstrap is false, skip/remove host pgpass bootstrap file (pgAdmin disabled)
 * @returns {Promise<Object>} Object with infraDir and postgresPassword
 */
async function prepareInfraDirectory(devId, adminSecretsPath, prepOptions = {}) {
  const aifabrixDir = paths.getAifabrixSystemDir();
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
  const postgresPassword =
    (adminObj.POSTGRES_PASSWORD && adminObj.POSTGRES_PASSWORD.trim()) ||
    readInfraDefaultScalars().adminPassword ||
    '';
  generatePgAdminConfig(infraDir, postgresPassword);

  const pgpassBootstrap = prepOptions.pgpassBootstrap !== false;
  const bootstrapPath = path.join(infraDir, PGPASS_BOOTSTRAP_BASENAME);
  if (pgpassBootstrap) {
    writePgpassBootstrap(infraDir, postgresPassword);
  } else {
    try {
      if (fs.existsSync(bootstrapPath)) {
        fs.unlinkSync(bootstrapPath);
      }
    } catch {
      // Ignore
    }
  }

  return { infraDir, postgresPassword };
}

/**
 * Resolve infra working directory and admin-secrets path for stop/restart.
 * Infra dir: prefer system dir compose; if missing, use legacy home when compose exists there.
 * Admin secrets: prefer `admin-secrets.env` under system dir; if missing, use legacy home (covers mixed layouts).
 *
 * @param {string|number} devId - Developer ID
 * @returns {{ infraDir: string, adminSecretsPath: string }}
 */
function resolveInfraStatePaths(devId) {
  const syncFs = nodeFs();
  const name = getInfraDirName(devId);
  const systemBase = paths.getAifabrixSystemDir();
  const legacyBase = paths.getAifabrixHome();
  const sysInfra = path.join(systemBase, name);
  const legInfra = path.join(legacyBase, name);
  const sysCompose = path.join(sysInfra, 'compose.yaml');
  const legCompose = path.join(legInfra, 'compose.yaml');
  let infraDir = sysInfra;
  if (!syncFs.existsSync(sysCompose) && syncFs.existsSync(legCompose) && legacyBase !== systemBase) {
    infraDir = legInfra;
  }
  const sysAdmin = path.join(systemBase, 'admin-secrets.env');
  const legAdmin = path.join(legacyBase, 'admin-secrets.env');
  let adminSecretsPath = sysAdmin;
  if (!syncFs.existsSync(sysAdmin) && syncFs.existsSync(legAdmin) && legacyBase !== systemBase) {
    adminSecretsPath = legAdmin;
  }
  return { infraDir, adminSecretsPath };
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
  writePgpassBootstrap,
  PGPASS_BOOTSTRAP_BASENAME,
  prepareInfraDirectory,
  resolveInfraStatePaths,
  ensureMisoInitScript,
  registerHandlebarsHelper
};
