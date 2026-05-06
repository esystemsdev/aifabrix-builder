/**
 * @fileoverview Discover kv:// keys for up-infra from workspace templates and application.yaml
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fsRealSync = require('../internal/fs-real-sync');
const path = require('path');
const { loadRequiresDatabasesArray } = require('./database-secret-values');

/**
 * Extract kv:// secret key names from env template content (active lines only).
 * @param {string} content - env.template body
 * @returns {string[]}
 */
function extractKvKeysFromEnvContent(content) {
  if (!content || typeof content !== 'string') return [];
  const keys = new Set();
  const kvPattern = /kv:\/\/([a-zA-Z0-9-_]+)/g;
  const lines = content.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (t === '' || t.startsWith('#')) continue;
    let m;
    kvPattern.lastIndex = 0;
    while ((m = kvPattern.exec(line)) !== null) {
      keys.add(m[1]);
    }
  }
  return [...keys];
}

/**
 * List builder app directories only (no integration/* apps).
 * Used by `parameters validate` so sample integrations do not require catalog entries.
 * @param {object} pathsUtil - paths module
 * @returns {{ appKey: string, dir: string }[]}
 */
function listBuilderAppDirsForDiscovery(pathsUtil) {
  const out = [];
  for (const name of pathsUtil.listBuilderAppNames()) {
    const dir = pathsUtil.getBuilderPath(name);
    if (fsRealSync.existsSync(dir)) {
      out.push({ appKey: name, dir });
    }
  }
  return out;
}

/**
 * List app directories for discovery (builder first, then integration-only apps).
 * @param {object} pathsUtil - paths module
 * @returns {{ appKey: string, dir: string }[]}
 */
function listAppDirsForDiscovery(pathsUtil) {
  const out = [];
  const seen = new Set();
  for (const name of pathsUtil.listBuilderAppNames()) {
    const dir = pathsUtil.getBuilderPath(name);
    if (fsRealSync.existsSync(dir)) {
      out.push({ appKey: name, dir });
      seen.add(name);
    }
  }
  for (const name of pathsUtil.listIntegrationAppNames()) {
    if (seen.has(name)) continue;
    const dir = pathsUtil.getIntegrationPath(name);
    if (fsRealSync.existsSync(dir)) {
      out.push({ appKey: name, dir });
    }
  }
  return out;
}

/**
 * Derive databases-{appKey}-{i}-url/password keys from requires.databases length.
 * @param {object} pathsUtil - paths module
 * @returns {string[]}
 */
function deriveDatabaseKvKeysFromWorkspace(pathsUtil) {
  const keys = new Set();
  for (const { appKey, dir } of listAppDirsForDiscovery(pathsUtil)) {
    const dbs = loadRequiresDatabasesArray(dir);
    if (!Array.isArray(dbs) || dbs.length === 0) continue;
    for (let i = 0; i < dbs.length; i++) {
      keys.add(`databases-${appKey}-${i}-urlKeyVault`);
      keys.add(`databases-${appKey}-${i}-passwordKeyVault`);
    }
  }
  return [...keys];
}

/**
 * Keys from env.template files whose catalog entry includes the given hook (e.g. upInfra).
 * @param {object} pathsUtil - paths module
 * @param {string} hook - ensureOn hook name
 * @param {{ keyMatchesEnsureHook: Function }} catalog - loaded catalog API
 * @returns {string[]}
 */
function discoverKvKeysFromEnvTemplatesForHook(pathsUtil, hook, catalog) {
  const keys = new Set();
  for (const { dir } of listAppDirsForDiscovery(pathsUtil)) {
    const envPath = path.join(dir, 'env.template');
    if (!fsRealSync.existsSync(envPath)) continue;
    let content;
    try {
      content = fsRealSync.readFileSync(envPath, 'utf8');
    } catch {
      continue;
    }
    for (const k of extractKvKeysFromEnvContent(content)) {
      if (catalog.keyMatchesEnsureHook(k, hook)) keys.add(k);
    }
  }
  return [...keys];
}

/**
 * Full key list for ensureInfraSecrets: catalog exact upInfra + standard miso DB + derived DB + template hooks.
 * @param {{ getEnsureOnKeys: Function, keyMatchesEnsureHook: Function }} catalog
 * @param {object} pathsUtil - paths module
 * @returns {string[]}
 */
function getAllInfraEnsureKeys(catalog, pathsUtil) {
  const set = new Set(catalog.getEnsureOnKeys('upInfra'));
  for (const k of catalog.getStandardUpInfraBootstrapKeys()) set.add(k);
  for (const k of deriveDatabaseKvKeysFromWorkspace(pathsUtil)) set.add(k);
  for (const k of discoverKvKeysFromEnvTemplatesForHook(pathsUtil, 'upInfra', catalog)) set.add(k);
  return [...set].sort();
}

module.exports = {
  extractKvKeysFromEnvContent,
  deriveDatabaseKvKeysFromWorkspace,
  discoverKvKeysFromEnvTemplatesForHook,
  getAllInfraEnsureKeys,
  listAppDirsForDiscovery,
  listBuilderAppDirsForDiscovery
};
