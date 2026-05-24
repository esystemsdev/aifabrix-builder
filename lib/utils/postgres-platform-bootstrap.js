/**
 * Recreate platform Postgres databases and roles after setup "wipe data".
 *
 * Infra init scripts run only on first volume creation; dropping DBs in a
 * running Postgres container requires explicit bootstrap before Keycloak/Miso start.
 *
 * @fileoverview Platform database bootstrap after postgres wipe
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const config = require('../core/config');
const adminSecrets = require('../core/admin-secrets');
const logger = require('./logger');
const chalk = require('chalk');
const { successGlyph } = require('./cli-test-layout-chalk');
const { getPostgresContainerName } = require('./postgres-wipe');
const dockerExec = require('./docker-exec');
const { isSetupQuietOutput } = require('./setup-quiet-output');

const SUPERUSER_ROLE = 'pgadmin';

/** @type {{ dbName: string, secretKey: string }[]} */
const PLATFORM_DATABASE_SLOTS = [
  { dbName: 'keycloak', secretKey: 'databases-keycloak-0-passwordKeyVault' },
  { dbName: 'miso', secretKey: 'databases-miso-controller-0-passwordKeyVault' },
  { dbName: 'miso-logs', secretKey: 'databases-miso-controller-1-passwordKeyVault' },
  { dbName: 'dataplane', secretKey: 'databases-dataplane-0-passwordKeyVault' },
  { dbName: 'dataplane-vector', secretKey: 'databases-dataplane-1-passwordKeyVault' },
  { dbName: 'dataplane-logs', secretKey: 'databases-dataplane-2-passwordKeyVault' },
  { dbName: 'dataplane-records', secretKey: 'databases-dataplane-3-passwordKeyVault' }
];

/**
 * @param {string} dbName
 * @returns {string}
 */
function pgRoleName(dbName) {
  return `${String(dbName).replace(/-/g, '_')}_user`;
}

/**
 * @param {string} s
 * @returns {string}
 */
function escapePgString(s) {
  if (s === null || s === undefined || typeof s !== 'string') return '';
  return s.replace(/'/g, '\'\'');
}

/**
 * @param {string} urlOrPassword
 * @returns {string|null}
 */
function extractPasswordFromUrlOrValue(urlOrPassword) {
  if (typeof urlOrPassword !== 'string' || urlOrPassword.length === 0) return null;
  if (!urlOrPassword.includes('://')) return urlOrPassword;
  try {
    const u = new URL(
      urlOrPassword.replace(/\$\{DB_HOST\}/g, 'postgres').replace(/\$\{DB_PORT\}/g, '5432')
    );
    return u.password || null;
  } catch {
    return null;
  }
}

/**
 * Escape SQL for embedding in a double-quoted shell argument (-c "...").
 * Bash expands `$` and `$$` (PID) inside double quotes; backslash-escape every `$`.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeShellDoubleQuoted(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
}

/**
 * @async
 * @param {string} container
 * @param {string} sql
 * @param {string} adminPassword
 * @returns {Promise<void>}
 */
async function runPsqlCommand(container, sql, adminPassword, database = 'postgres') {
  const escapedSql = escapeShellDoubleQuoted(sql);
  const cmd =
    `docker exec -e PGPASSWORD -i ${container} psql -U ${SUPERUSER_ROLE} -d ${database} ` +
    `-v ON_ERROR_STOP=1 -c "${escapedSql}"`;
  await dockerExec.execWithDockerEnv(cmd, { env: { PGPASSWORD: adminPassword } });
}

/**
 * @async
 * @param {string} container
 * @param {string} dbName
 * @param {string} role
 * @param {string} password
 * @param {string} adminPassword
 * @returns {Promise<void>}
 */
async function ensureRoleAndDatabase(container, dbName, role, password, adminPassword) {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(dbName) || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(role)) {
    throw new Error(`Unsafe database or role name: ${dbName} / ${role}`);
  }
  const pwd = escapePgString(password);
  await runPsqlCommand(
    container,
    `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN CREATE USER "${role}" WITH PASSWORD '${pwd}'; ELSE ALTER USER "${role}" WITH PASSWORD '${pwd}'; END IF; END $$;`,
    adminPassword
  );
  const exists = await dockerExec.execWithDockerEnv(
    `docker exec -e PGPASSWORD -i ${container} psql -U ${SUPERUSER_ROLE} -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${dbName}'"`,
    { env: { PGPASSWORD: adminPassword } }
  );
  const hasDb = String((exists && exists.stdout) || '').trim() === '1';
  if (!hasDb) {
    await runPsqlCommand(
      container,
      `CREATE DATABASE "${dbName}" OWNER "${role}";`,
      adminPassword
    );
  }
  await runPsqlCommand(
    container,
    `GRANT ALL ON SCHEMA public TO "${role}"; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${role}";`,
    adminPassword,
    dbName
  );
}

/**
 * @async
 * @param {string} container
 * @param {{ dbName: string, secretKey: string }} slot
 * @param {Object} secrets
 * @param {string} adminPassword
 * @returns {Promise<string>}
 */
async function ensurePlatformDatabaseSlot(container, slot, secrets, adminPassword) {
  const raw = secrets[slot.secretKey];
  const password = extractPasswordFromUrlOrValue(raw);
  if (!password || !password.trim()) {
    throw new Error(
      `Secret ${slot.secretKey} is missing or empty. Run "aifabrix up-infra" to ensure infra secrets.`
    );
  }
  const role = pgRoleName(slot.dbName);
  await ensureRoleAndDatabase(container, slot.dbName, role, password.trim(), adminPassword);
  if (!isSetupQuietOutput()) {
    logger.log(chalk.gray(` ${successGlyph()} Ensured database ${slot.dbName} (${role})`));
  }
  return slot.dbName;
}

/**
 * @async
 * @returns {Promise<{ container: string, adminPassword: string, secrets: Object }>}
 */
async function resolveBootstrapContext() {
  const devId = await config.getDeveloperId();
  const container = getPostgresContainerName(devId);
  const admin = await adminSecrets.readAndDecryptAdminSecrets();
  const adminPassword = admin && admin.POSTGRES_PASSWORD;
  if (!adminPassword) {
    throw new Error('POSTGRES_PASSWORD not found in admin-secrets.env. Run "aifabrix up-infra" first.');
  }
  const secretsEnsure = require('../core/secrets-ensure');
  await secretsEnsure.ensureInfraSecrets();
  const { loadSecrets } = require('../core/secrets');
  const secrets = await loadSecrets(undefined);
  return { container, adminPassword, secrets };
}

/**
 * Recreate platform DB users and databases from resolved kv secrets.
 *
 * @async
 * @returns {Promise<string[]>} database names ensured
 */
async function bootstrapPlatformPostgresDatabases() {
  const { container, adminPassword, secrets } = await resolveBootstrapContext();
  const ensured = [];
  for (const slot of PLATFORM_DATABASE_SLOTS) {
    ensured.push(await ensurePlatformDatabaseSlot(container, slot, secrets, adminPassword));
  }
  return ensured;
}

module.exports = {
  PLATFORM_DATABASE_SLOTS,
  bootstrapPlatformPostgresDatabases,
  pgRoleName,
  extractPasswordFromUrlOrValue,
  escapeShellDoubleQuoted
};
