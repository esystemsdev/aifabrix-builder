/**
 * Helpers for application run: clean applications dir, build merged .env, compose safeguard.
 * Keeps run-helpers.js under line limit.
 *
 * @fileoverview Run env and compose helpers
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const pathsUtil = require('../utils/paths');
const adminSecrets = require('../core/admin-secrets');
const secretsEnvWrite = require('../core/secrets-env-write');
const { getContainerPort } = require('../utils/port-resolver');
const { getInfraDirName } = require('../infrastructure/helpers');

/**
 * Clean applications directory: remove generated docker-compose.yaml and .env.* files.
 * @param {string|number} developerId - Developer ID
 */
function cleanApplicationsDir(developerId) {
  const baseDir = pathsUtil.getApplicationsBaseDir(developerId);
  if (!fsSync.existsSync(baseDir)) return;
  const toRemove = [path.join(baseDir, 'docker-compose.yaml')];
  try {
    const entries = fsSync.readdirSync(baseDir);
    for (const name of entries) {
      if (name.startsWith('.env.')) toRemove.push(path.join(baseDir, name));
    }
  } catch {
    // Ignore readdir errors
  }
  for (const filePath of toRemove) {
    try {
      if (fsSync.existsSync(filePath)) fsSync.unlinkSync(filePath);
    } catch {
      // Ignore unlink errors
    }
  }
}

/**
 * Derive PostgreSQL user from database name (same as compose-handlebars-helpers pgUserName).
 * @param {string} dbName - Database name (e.g. keycloak)
 * @returns {string} User name (e.g. keycloak_user)
 */
function pgUserName(dbName) {
  if (!dbName) return '';
  return `${String(dbName).replace(/-/g, '_')}_user`;
}

/**
 * Inject DB_N_NAME and DB_N_USER from application.yaml databases into env so .env has everything.
 * @param {Object} env - Merged env object (mutated)
 * @param {Object} appConfig - Application config (requires.databases or databases array)
 */
function injectDatabaseNamesAndUsers(env, appConfig, scopeOpts = null) {
  const databases = appConfig?.requires?.databases || appConfig?.databases;
  if (!Array.isArray(databases) || databases.length === 0) return;
  const prefix =
    scopeOpts &&
    scopeOpts.effectiveEnvironmentScopedResources &&
    scopeOpts.runEnvKey &&
    (scopeOpts.runEnvKey === 'dev' || scopeOpts.runEnvKey === 'tst')
      ? `${String(scopeOpts.runEnvKey).toLowerCase()}-`
      : '';
  for (let i = 0; i < databases.length; i++) {
    const db = databases[i];
    const baseName = db?.name || (appConfig?.app?.key || 'app');
    const name = prefix ? `${prefix}${baseName}` : baseName;
    env[`DB_${i}_NAME`] = name;
    env[`DB_${i}_USER`] = pgUserName(name);
  }
}

/**
 * Get the env var name used for PORT in env.template (e.g. PORT=${MISO_PORT} -> MISO_PORT).
 * @param {string} appName - Application name
 * @returns {string|null} Variable name or null if not found
 */
function getPortVarFromEnvTemplate(appName) {
  const builderPath = pathsUtil.getBuilderPath(appName);
  const templatePath = path.join(builderPath, 'env.template');
  if (!fsSync.existsSync(templatePath)) return null;
  try {
    const content = fsSync.readFileSync(templatePath, 'utf8');
    const m = content.match(/^PORT\s*=\s*\$\{([A-Za-z0-9_]+)\}/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Override PORT and the template's port variable (e.g. MISO_PORT) with container port from application.yaml.
 * Run .env only: when running in Docker, the app listens on the container port (port or build.containerPort), not localPort.
 * For envOutputPath .env (local, not reload) we use localPort instead - see adjustLocalEnvPortsInContent in secrets-helpers.
 * @param {Object} env - Merged env object (mutated)
 * @param {Object} appConfig - Application configuration (port, build.containerPort)
 * @param {string} appName - Application name (to resolve env.template port var)
 */
function injectContainerPortForRun(env, appConfig, appName) {
  const containerPort = getContainerPort(appConfig, 3000);
  env.PORT = String(containerPort);
  const portVar = getPortVarFromEnvTemplate(appName);
  if (portVar) {
    env[portVar] = String(containerPort);
  }
}

/** Keys that must never be passed to the app container (admin/start-only). */
const ADMIN_ONLY_KEYS = [
  'POSTGRES_PASSWORD',
  'PGADMIN_DEFAULT_EMAIL',
  'PGADMIN_DEFAULT_PASSWORD',
  'REDIS_HOST',
  'REDIS_COMMANDER_USER',
  'REDIS_COMMANDER_PASSWORD'
];

/**
 * Build app-only env (merged minus admin secrets). App container must not receive admin passwords.
 * @param {Object} merged - Full merged env
 * @returns {Object} Env object safe for app container
 */
function buildAppOnlyEnv(merged) {
  const appOnly = {};
  for (const [k, v] of Object.entries(merged)) {
    if (ADMIN_ONLY_KEYS.includes(k)) continue;
    appOnly[k] = v;
  }
  return appOnly;
}

/**
 * Build env for db-init only: POSTGRES_PASSWORD + DB_N_PASSWORD, DB_N_NAME, DB_N_USER. Used only for start, not in app container.
 * @param {Object} merged - Full merged env
 * @returns {Object} Env object for db-init service only
 */
function buildDbInitOnlyEnv(merged) {
  const dbInit = {};
  if (merged.POSTGRES_PASSWORD !== undefined) {
    dbInit.POSTGRES_PASSWORD = merged.POSTGRES_PASSWORD;
  }
  for (const [k, v] of Object.entries(merged)) {
    if (k.startsWith('DB_') && (k.endsWith('_PASSWORD') || k.endsWith('_NAME') || k.endsWith('_USER'))) {
      dbInit[k] = v;
    }
  }
  return dbInit;
}

/**
 * Return pgpass paths under infra-dev* directories in aifabrix home (for fallback lookup).
 * @param {string} aifabrixDir - Aifabrix home directory
 * @returns {string[]} Paths to pgpass files
 */
function getInfraDevPgpassPaths(aifabrixDir) {
  if (!fsSync.existsSync(aifabrixDir)) return [];
  let entries;
  try {
    entries = fsSync.readdirSync(aifabrixDir).sort();
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.startsWith('infra-dev'))
    .map((name) => path.join(aifabrixDir, name, 'pgpass'));
}

/**
 * Read first password from a pgpass file (format host:port:db:user:password).
 * @param {string} pgpassPath - Path to pgpass file
 * @returns {Promise<string|undefined>} Password or undefined
 */
async function readPasswordFromPgpassFile(pgpassPath) {
  const content = await fs.readFile(pgpassPath, 'utf8');
  const line = content.split('\n')[0];
  if (!line) return undefined;
  const parts = line.split(':');
  return parts.length >= 5 ? parts[4].trim() : undefined;
}

/**
 * Read POSTGRES_PASSWORD from an existing infra pgpass so db-init uses the same password as running Postgres.
 * Tries dev-specific, then default infra, then any infra-dev* dir (e.g. dev 1 run when only infra-dev06 has pgpass).
 * @param {number|string} developerId - Developer ID
 * @returns {Promise<string|undefined>} Password or undefined
 */
async function readPostgresPasswordFromPgpass(developerId) {
  const home = pathsUtil.getAifabrixHome();
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  const candidates = [path.join(home, getInfraDirName(developerId), 'pgpass')];
  if (idNum !== 0) candidates.push(path.join(home, getInfraDirName(0), 'pgpass'));
  const extra = getInfraDevPgpassPaths(home).filter((p) => !candidates.includes(p));
  candidates.push(...extra);
  for (const pgpassPath of candidates) {
    if (!fsSync.existsSync(pgpassPath)) continue;
    try {
      const pwd = await readPasswordFromPgpassFile(pgpassPath);
      if (pwd !== undefined) return pwd;
    } catch {
      // ignore
    }
  }
  return undefined;
}

/**
 * Build two run env files: .env.run (app-only, no admin secrets) and .env.run.admin (start-only, for db-init).
 * Admin password is never set in the app container; .env.run.admin is used only for start and then deleted.
 * When an infra pgpass exists, POSTGRES_PASSWORD is taken from it so db-init matches the running Postgres.
 * @async
 * @param {string} appName - Application name
 * @param {Object} appConfig - Application configuration
 * @param {string} devDir - Applications directory path
 * @param {number|string} [developerId] - Developer ID (for pgpass lookup)
 * @returns {Promise<{ runEnvPath: string, runEnvAdminPath: string }>} Paths to .env.run and .env.run.admin
 */
async function buildMergedRunEnvAndWrite(appName, appConfig, devDir, developerId, scopeOpts = null) {
  const infra = require('../infrastructure');
  const ensureAdminSecretsFn = typeof infra.ensureAdminSecrets === 'function'
    ? infra.ensureAdminSecrets
    : require('../infrastructure/helpers').ensureAdminSecrets;
  await ensureAdminSecretsFn();
  const adminObj = await adminSecrets.readAndDecryptAdminSecrets();
  const runEnvKey = scopeOpts && scopeOpts.runEnvKey ? String(scopeOpts.runEnvKey).toLowerCase() : 'dev';
  const appObj = await secretsEnvWrite.resolveAndGetEnvMap(appName, {
    environment: 'docker',
    secretsPath: null,
    force: false,
    runEnvKey
  });
  const merged = { ...adminObj, ...appObj };
  if (developerId !== undefined) {
    const pgpassPwd = await readPostgresPasswordFromPgpass(developerId);
    if (pgpassPwd !== undefined) merged.POSTGRES_PASSWORD = pgpassPwd;
  }
  injectDatabaseNamesAndUsers(merged, appConfig, scopeOpts);
  injectContainerPortForRun(merged, appConfig, appName);

  const runEnvPath = path.join(devDir, '.env.run');
  const runEnvAdminPath = path.join(devDir, '.env.run.admin');

  const appOnly = buildAppOnlyEnv(merged);
  const dbInitOnly = buildDbInitOnlyEnv(merged);

  await fs.writeFile(runEnvPath, adminSecrets.envObjectToContent(appOnly), { mode: 0o600 });
  await fs.writeFile(runEnvAdminPath, adminSecrets.envObjectToContent(dbInitOnly), { mode: 0o600 });

  return { runEnvPath, runEnvAdminPath };
}

/**
 * Assert generated compose does not contain password literals in environment (ISO 27K).
 * @param {string} composeContent - Generated docker-compose content
 * @throws {Error} If password keys appear in environment-like assignment
 */
function assertNoPasswordLiteralsInCompose(composeContent) {
  const badPattern = /\n\s+(-?\s*)(POSTGRES_PASSWORD|DB_\d+_PASSWORD)\s*[:=]/;
  if (badPattern.test(composeContent)) {
    throw new Error('Generated compose must not contain password literals (POSTGRES_PASSWORD, DB_*_PASSWORD). Use env_file only.');
  }
}

module.exports = {
  cleanApplicationsDir,
  buildMergedRunEnvAndWrite,
  assertNoPasswordLiteralsInCompose
};
