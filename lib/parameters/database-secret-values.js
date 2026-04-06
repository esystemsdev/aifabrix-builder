/**
 * @fileoverview Index-aware local PostgreSQL URL/password defaults for databases-{app}-{i}-* keys
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/** Default miso-controller DB logical names by index (matches application.yaml requires.databases order). */
const MISO_CONTROLLER_DATABASE_NAMES = ['miso', 'miso-logs'];

/**
 * PostgreSQL role name from database name (same as compose pgUserName helper).
 * @param {string} dbName - Logical database name (e.g. miso-logs)
 * @returns {string}
 */
function pgUserFromDbName(dbName) {
  if (!dbName) return '';
  return `${String(dbName).replace(/-/g, '_')}_user`;
}

/**
 * Local dev password aligned with infra init scripts (user base + _pass123).
 * @param {string} userName - e.g. miso_user, miso_logs_user
 * @returns {string}
 */
function localDevPasswordFromPgUser(userName) {
  const base = String(userName).replace(/_user$/i, '');
  return `${base}_pass123`;
}

/**
 * Load requires.databases from application config if present (read-only; no rename).
 * @param {string} appDir - Absolute path to builder/integration app folder
 * @returns {Array<{name?: string}>|null}
 */
function loadRequiresDatabasesArray(appDir) {
  if (!appDir || !fs.existsSync(appDir)) return null;
  const candidates = ['application.yaml', 'application.yml', 'variables.yaml'];
  for (const name of candidates) {
    const p = path.join(appDir, name);
    if (!fs.existsSync(p)) continue;
    try {
      const doc = yaml.load(fs.readFileSync(p, 'utf8'));
      const dbs = doc?.requires?.databases;
      if (Array.isArray(dbs) && dbs.length > 0) return dbs;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Resolve logical PostgreSQL database name for a databases-{appKey}-{index}-* key.
 * @param {string} appKey - App key segment from secret key
 * @param {number} index - Database index
 * @param {string|null} appDir - Optional app directory to read application.yaml
 * @returns {string}
 */
function resolveLogicalDbName(appKey, index, appDir) {
  if (appKey === 'miso-controller' && index >= 0 && index < MISO_CONTROLLER_DATABASE_NAMES.length) {
    return MISO_CONTROLLER_DATABASE_NAMES[index];
  }
  const dbs = appDir ? loadRequiresDatabasesArray(appDir) : null;
  if (dbs && dbs[index] && dbs[index].name) {
    return String(dbs[index].name);
  }
  if (index === 0) {
    return String(appKey).replace(/-/g, '_');
  }
  return `${String(appKey).replace(/-/g, '_')}_${index}`;
}

/**
 * Parse databases-{appKey}-{index}-(urlKeyVault|passwordKeyVault).
 * @param {string} key - Secret key
 * @returns {{ appKey: string, index: number, kind: 'url'|'password' }|null}
 */
function parseDatabaseSecretKey(key) {
  const m = String(key).match(/^databases-([a-z0-9-]+)-(\d+)-(urlKeyVault|passwordKeyVault)$/i);
  if (!m) return null;
  return {
    appKey: m[1],
    index: parseInt(m[2], 10),
    kind: m[3].toLowerCase().startsWith('url') ? 'url' : 'password'
  };
}

/**
 * Build postgres URL with unresolved host/port placeholders.
 * @param {string} dbName - Database name in connection path (may contain hyphens)
 * @param {string} userName - DB user
 * @param {string} password - DB password
 * @returns {string}
 */
function buildPostgresUrlTemplate(dbName, userName, password) {
  return `postgresql://${userName}:${password}@\${DB_HOST}:\${DB_PORT}/${dbName}`;
}

/**
 * Generate password value for databases-*-passwordKeyVault.
 * @param {string} key - Full secret key
 * @param {string|null} appDir - Optional app directory for YAML lookup
 * @returns {string|null} Value or null if key does not match
 */
function generateDatabasePasswordValueForKey(key, appDir = null) {
  const parsed = parseDatabaseSecretKey(key);
  if (!parsed || parsed.kind !== 'password') return null;
  const dbName = resolveLogicalDbName(parsed.appKey, parsed.index, appDir);
  const user = pgUserFromDbName(dbName);
  return localDevPasswordFromPgUser(user);
}

/**
 * Generate URL value for databases-*-urlKeyVault.
 * @param {string} key - Full secret key
 * @param {string|null} appDir - Optional app directory for YAML lookup
 * @returns {string|null} Value or null if key does not match
 */
function generateDatabaseUrlValueForKey(key, appDir = null) {
  const parsed = parseDatabaseSecretKey(key);
  if (!parsed || parsed.kind !== 'url') return null;
  const dbName = resolveLogicalDbName(parsed.appKey, parsed.index, appDir);
  const user = pgUserFromDbName(dbName);
  const pass = localDevPasswordFromPgUser(user);
  return buildPostgresUrlTemplate(dbName, user, pass);
}

module.exports = {
  parseDatabaseSecretKey,
  generateDatabasePasswordValueForKey,
  generateDatabaseUrlValueForKey,
  loadRequiresDatabasesArray,
  resolveLogicalDbName,
  MISO_CONTROLLER_DATABASE_NAMES
};
