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
const handlebars = require('handlebars');
const secrets = require('../core/secrets');
const logger = require('../utils/logger');
const dockerUtils = require('../utils/docker');
const paths = require('../utils/paths');

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
 * Ensure admin secrets file exists and backfill empty password fields with default for new local installs
 * @async
 * @returns {Promise<string>} Path to admin secrets file
 */
async function ensureAdminSecrets() {
  const adminSecretsPath = path.join(paths.getAifabrixHome(), 'admin-secrets.env');
  if (!fs.existsSync(adminSecretsPath)) {
    logger.log('Generating admin-secrets.env...');
    await secrets.generateAdminSecretsEnv();
  }
  let content = fs.readFileSync(adminSecretsPath, 'utf8');
  const needsBackfill = /^POSTGRES_PASSWORD=\s*$/m.test(content) ||
    /^PGADMIN_DEFAULT_PASSWORD=\s*$/m.test(content) ||
    /^REDIS_COMMANDER_PASSWORD=\s*$/m.test(content);
  if (needsBackfill) {
    content = content.replace(/^POSTGRES_PASSWORD=\s*$/m, `POSTGRES_PASSWORD=${DEFAULT_ADMIN_PASSWORD}`);
    content = content.replace(/^PGADMIN_DEFAULT_PASSWORD=\s*$/m, `PGADMIN_DEFAULT_PASSWORD=${DEFAULT_ADMIN_PASSWORD}`);
    content = content.replace(/^REDIS_COMMANDER_PASSWORD=\s*$/m, `REDIS_COMMANDER_PASSWORD=${DEFAULT_ADMIN_PASSWORD}`);
    fs.writeFileSync(adminSecretsPath, content, { mode: 0o600 });
    logger.log('Set default admin password in admin-secrets.env for local use.');
  }
  return adminSecretsPath;
}

/**
 * Generates pgAdmin4 configuration files (servers.json and pgpass)
 * @param {string} infraDir - Infrastructure directory path
 * @param {string} postgresPassword - PostgreSQL password
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

  const pgpassContent = `postgres:5432:postgres:pgadmin:${postgresPassword}\n`;
  const pgpassPath = path.join(infraDir, 'pgpass');
  fs.writeFileSync(pgpassPath, pgpassContent, { mode: 0o600 });
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
 * Uses password from secrets (databases-miso-controller-0-passwordKeyVault) or default miso_pass123.
 * Init scripts run only when the Postgres data volume is first created. If infra was already
 * started before this script existed, run `aifabrix down-infra -v` then `aifabrix up-infra` to re-init, or
 * create the database and user manually (e.g. via pgAdmin or psql).
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

  let password = 'miso_pass123';
  try {
    const loaded = await secrets.loadSecrets(undefined);
    const urlOrPassword = loaded['databases-miso-controller-0-passwordKeyVault'] ||
      loaded['databases-miso-controller-0-urlKeyVault'];
    const extracted = extractPasswordFromUrlOrValue(urlOrPassword);
    if (extracted !== null) password = extracted;
  } catch {
    // No secrets or load failed; use default
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
 * Prepare infrastructure directory and extract postgres password
 * @param {string} devId - Developer ID
 * @param {string} adminSecretsPath - Path to admin secrets file
 * @returns {Object} Object with infraDir and postgresPassword
 */
function prepareInfraDirectory(devId, adminSecretsPath) {
  const aifabrixDir = paths.getAifabrixHome();
  const infraDirName = getInfraDirName(devId);
  const infraDir = path.join(aifabrixDir, infraDirName);
  if (!fs.existsSync(infraDir)) {
    fs.mkdirSync(infraDir, { recursive: true });
  }

  const adminSecretsContent = fs.readFileSync(adminSecretsPath, 'utf8');
  const postgresPasswordMatch = adminSecretsContent.match(/^POSTGRES_PASSWORD=(.+)$/m);
  const raw = postgresPasswordMatch ? postgresPasswordMatch[1] : '';
  const postgresPassword = (raw && raw.trim()) || DEFAULT_ADMIN_PASSWORD;
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
