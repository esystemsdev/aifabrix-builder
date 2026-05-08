/**
 * Postgres data wipe helper for `aifabrix setup` Mode 2 (Wipe data).
 *
 * Drops every non-template database and every non-superuser role in the
 * developer's running Postgres container, while preserving the volume,
 * the `postgres` superuser, and the admin password (so the post-wipe
 * `up-infra` and platform bootstrap recreate schemas + service users).
 *
 * Uses `docker exec` with the admin password passed via the container's
 * environment (PGPASSWORD) so it is not visible in `ps`.
 *
 * @fileoverview Drop all DBs and roles in dev Postgres for setup Mode 2
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const config = require('../core/config');
const adminSecrets = require('../core/admin-secrets');
const dockerExec = require('./docker-exec');
const logger = require('./logger');
const { formatSuccessLine } = require('./cli-test-layout-chalk');

/** Roles that must never be dropped (Postgres-managed predefined roles). */
const PROTECTED_ROLES = new Set([
  'postgres',
  'pg_signal_backend',
  'pg_read_server_files',
  'pg_write_server_files',
  'pg_execute_server_program',
  'pg_monitor',
  'pg_read_all_settings',
  'pg_read_all_stats',
  'pg_stat_scan_tables',
  'pg_database_owner',
  'pg_read_all_data',
  'pg_write_all_data',
  'pg_checkpoint',
  'pg_use_reserved_connections',
  'pg_create_subscription'
]);

/** Databases that must never be dropped. */
const PROTECTED_DATABASES = new Set(['postgres', 'template0', 'template1']);

/**
 * Compute the developer-scoped Postgres container name.
 * Mirrors `getInfraContainerNames` in `lib/utils/infra-status.js`.
 * @param {number|string} devId - Developer ID
 * @returns {string}
 */
function getPostgresContainerName(devId) {
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  if (idNum === 0) return 'aifabrix-postgres';
  return `aifabrix-dev${devId}-postgres`;
}

/**
 * Run `psql -t -A -c <sql>` inside the Postgres container with PGPASSWORD set
 * via `-e PGPASSWORD=...` so the secret never appears on the command line.
 *
 * @async
 * @param {string} container - Container name
 * @param {string} sql - Single SQL statement (no shell metacharacters)
 * @param {string} adminPassword - Postgres superuser password
 * @returns {Promise<string>} stdout (trimmed)
 * @throws {Error} If the docker exec invocation fails
 */
async function runPsql(container, sql, adminPassword) {
  if (!container || typeof container !== 'string') {
    throw new Error('Postgres container name is required');
  }
  if (!sql || typeof sql !== 'string') {
    throw new Error('SQL statement is required');
  }
  if (!adminPassword || typeof adminPassword !== 'string') {
    throw new Error('Admin password is required');
  }
  const escapedSql = sql.replace(/"/g, '\\"');
  const cmd = `docker exec -e PGPASSWORD -i ${container} psql -U postgres -d postgres -tAc "${escapedSql}"`;
  const env = { PGPASSWORD: adminPassword };
  const result = (await dockerExec.execWithDockerEnv(cmd, { env })) || {};
  return String(result.stdout || '').trim();
}

/**
 * List user databases (non-template, not in PROTECTED_DATABASES).
 * @async
 * @param {string} container - Container name
 * @param {string} adminPassword - Postgres superuser password
 * @returns {Promise<string[]>} database names
 */
async function listUserDatabases(container, adminPassword) {
  const out = await runPsql(
    container,
    'SELECT datname FROM pg_database WHERE datistemplate = false;',
    adminPassword
  );
  return out
    .split('\n')
    .map(s => s.trim())
    .filter(name => name && !PROTECTED_DATABASES.has(name));
}

/**
 * List dropable roles (non-superuser, not in PROTECTED_ROLES).
 * @async
 * @param {string} container - Container name
 * @param {string} adminPassword - Postgres superuser password
 * @returns {Promise<string[]>} role names
 */
async function listDropableRoles(container, adminPassword) {
  const out = await runPsql(
    container,
    'SELECT rolname FROM pg_roles WHERE rolsuper = false;',
    adminPassword
  );
  return out
    .split('\n')
    .map(s => s.trim())
    .filter(name => name && !PROTECTED_ROLES.has(name) && !name.startsWith('pg_'));
}

/**
 * Drop a single database (forces disconnection of active sessions).
 * @async
 * @param {string} container
 * @param {string} dbName
 * @param {string} adminPassword
 * @returns {Promise<void>}
 */
async function dropDatabase(container, dbName, adminPassword) {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(dbName)) {
    throw new Error(`Refusing to drop database with unsafe name: ${dbName}`);
  }
  await runPsql(
    container,
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();`,
    adminPassword
  );
  await runPsql(container, `DROP DATABASE IF EXISTS "${dbName}";`, adminPassword);
}

/**
 * Drop a single role (REASSIGN OWNED + DROP OWNED first to clear dependencies).
 * @async
 * @param {string} container
 * @param {string} role
 * @param {string} adminPassword
 * @returns {Promise<void>}
 */
async function dropRole(container, role, adminPassword) {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(role)) {
    throw new Error(`Refusing to drop role with unsafe name: ${role}`);
  }
  await runPsql(
    container,
    `REASSIGN OWNED BY "${role}" TO postgres;`,
    adminPassword
  ).catch(() => undefined);
  await runPsql(container, `DROP OWNED BY "${role}" CASCADE;`, adminPassword).catch(() => undefined);
  await runPsql(container, `DROP ROLE IF EXISTS "${role}";`, adminPassword);
}

/**
 * Drop every non-template database and every non-superuser role in the
 * developer's running Postgres container. Caller must ensure infra is up.
 *
 * @async
 * @function wipePostgresData
 * @returns {Promise<{ databases: string[], roles: string[] }>} dropped names
 * @throws {Error} If admin secrets are missing or psql calls fail
 */
async function wipePostgresData() {
  const devId = await config.getDeveloperId();
  const container = getPostgresContainerName(devId);
  const admin = await adminSecrets.readAndDecryptAdminSecrets();
  const password = admin && admin.POSTGRES_PASSWORD;
  if (!password) {
    throw new Error('POSTGRES_PASSWORD not found in admin-secrets.env. Run "aifabrix up-infra" first.');
  }

  const databases = await listUserDatabases(container, password);
  for (const dbName of databases) {
    await dropDatabase(container, dbName, password);
    logger.log(formatSuccessLine(`Dropped database ${dbName}`));
  }

  const roles = await listDropableRoles(container, password);
  for (const role of roles) {
    await dropRole(container, role, password);
    logger.log(formatSuccessLine(`Dropped role ${role}`));
  }

  return { databases, roles };
}

module.exports = {
  wipePostgresData,
  getPostgresContainerName,
  PROTECTED_DATABASES,
  PROTECTED_ROLES
};
