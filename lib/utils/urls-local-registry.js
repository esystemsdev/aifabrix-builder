/**
 * urls.local.yaml beside effective config.yaml (same directory as secrets.local.yaml).
 * When AIFABRIX_HOME is POSIX $HOME but config lives in $HOME/.aifabrix/, the registry
 * is $HOME/.aifabrix/urls.local.yaml (not $HOME/urls.local.yaml).
 *
 * @fileoverview Read/write registry; scan each builder app folder for application.yaml
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fsRealSync = require('../internal/fs-real-sync');
const path = require('path');
const yaml = require('js-yaml');
const { DECLARATIVE_URL_INFRA_DEFAULTS } = require('./infra-env-defaults');
const pathsUtil = require('./paths');

/**
 * @returns {string} Absolute path to urls.local.yaml (primary; beside config.yaml)
 */
function getUrlsLocalYamlPath() {
  return path.join(pathsUtil.getConfigDirForPaths(), 'urls.local.yaml');
}

/** @returns {string} Legacy path when registry was stored under getAifabrixHome() only */
function getLegacyUrlsLocalYamlPath() {
  return path.join(pathsUtil.getAifabrixHome(), 'urls.local.yaml');
}

function loadRegistryYamlFile(filePath) {
  try {
    const doc = yaml.load(fsRealSync.readFileSync(filePath, 'utf8'));
    return doc && typeof doc === 'object' ? doc : {};
  } catch {
    return {};
  }
}

/**
 * @returns {Record<string, unknown>}
 */
function readUrlsLocalRegistrySync() {
  const primary = getUrlsLocalYamlPath();
  if (fsRealSync.existsSync(primary)) {
    return loadRegistryYamlFile(primary);
  }
  const legacy = getLegacyUrlsLocalYamlPath();
  if (legacy !== primary && fsRealSync.existsSync(legacy)) {
    return loadRegistryYamlFile(legacy);
  }
  return {};
}

/**
 * @param {Object} data - Full registry object to write
 */
function writeUrlsLocalRegistrySync(data) {
  const p = getUrlsLocalYamlPath();
  const dir = path.dirname(p);
  if (!fsRealSync.existsSync(dir)) {
    fsRealSync.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const body = `${yaml.dump(data, { lineWidth: 120, noRefs: true }).trim()}\n`;
  fsRealSync.writeFileSync(p, body, { mode: 0o600 });
}

/**
 * Normalize front-door pattern for URLs (/data/* → /data).
 * @param {string} pattern
 * @returns {string}
 */
function normalizePatternForUrl(pattern) {
  if (!pattern || typeof pattern !== 'string') {
    return '/';
  }
  let p = pattern.trim();
  if (!p.startsWith('/')) {
    p = `/${p}`;
  }
  p = p.replace(/\*+$/, '').replace(/\/+$/, '') || '/';
  return p;
}

/**
 * @param {Object} merged
 * @returns {Object} same object after persist
 */
function writeMergedRegistry(merged) {
  writeUrlsLocalRegistrySync(merged);
  return merged;
}

/**
 * @param {string} cfgPath
 * @returns {object|null}
 */
function tryLoadApplicationYaml(cfgPath) {
  if (!fsRealSync.existsSync(cfgPath)) {
    return null;
  }
  try {
    const doc = yaml.load(fsRealSync.readFileSync(cfgPath, 'utf8'));
    return doc && typeof doc === 'object' ? doc : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} doc
 * @returns {number|null}
 */
function readExplicitContainerPortFromDoc(doc) {
  const cpRaw = doc.build && doc.build.containerPort;
  if (typeof cpRaw === 'number' && cpRaw > 0) {
    return cpRaw;
  }
  if (typeof cpRaw === 'string' && /^\d+$/.test(cpRaw.trim())) {
    return parseInt(cpRaw.trim(), 10);
  }
  return null;
}

/**
 * @param {Object} merged
 * @param {object} doc
 * @param {string} folderName - builder/<folderName>
 */
function mergeDocIntoRegistry(merged, doc, folderName) {
  const appKey = (doc.app && doc.app.key) || folderName;
  let port = null;
  if (typeof doc.port === 'number' && doc.port > 0) {
    port = doc.port;
  } else if (typeof doc.port === 'string' && /^\d+$/.test(doc.port.trim())) {
    port = parseInt(doc.port.trim(), 10);
  }
  if (port === null || port <= 0) {
    return;
  }
  const rawPattern = doc.frontDoorRouting && doc.frontDoorRouting.pattern;
  const pattern =
    typeof rawPattern === 'string'
      ? rawPattern
      : DECLARATIVE_URL_INFRA_DEFAULTS.frontDoorPatternWhenUnspecified;
  merged[`${appKey}-port`] = port;
  merged[`${appKey}-pattern`] = pattern;

  const explicitC = readExplicitContainerPortFromDoc(doc);
  const ckey = `${appKey}-containerPort`;
  if (explicitC !== null) {
    merged[ckey] = explicitC;
  } else {
    delete merged[ckey];
  }
}

/**
 * Merge scan results into registry (does not remove stale keys).
 * @param {string|null} projectRoot - getProjectRoot() or null
 * @returns {Object} Updated registry
 */
function refreshUrlsLocalRegistryFromBuilder(projectRoot) {
  const root = projectRoot || pathsUtil.getProjectRoot();
  const merged = { ...readUrlsLocalRegistrySync() };
  if (!root) {
    return writeMergedRegistry(merged);
  }
  const builderDir = path.join(root, 'builder');
  if (!fsRealSync.existsSync(builderDir) || !fsRealSync.statSync(builderDir).isDirectory()) {
    return writeMergedRegistry(merged);
  }
  for (const ent of fsRealSync.readdirSync(builderDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) {
      continue;
    }
    const doc = tryLoadApplicationYaml(path.join(builderDir, ent.name, 'application.yaml'));
    if (!doc) {
      continue;
    }
    mergeDocIntoRegistry(merged, doc, ent.name);
  }
  return writeMergedRegistry(merged);
}

/**
 * @param {string} appKey
 * @param {Object} registry
 * @returns {{ port: number, containerPort: number|null, pattern: string }|null}
 */
function getRegistryEntryForApp(appKey, registry) {
  const r = registry || {};
  const portKey = `${appKey}-port`;
  const patKey = `${appKey}-pattern`;
  const cportKey = `${appKey}-containerPort`;
  const port = r[portKey];
  const pattern = r[patKey];
  const cport = r[cportKey];
  if (typeof port !== 'number' || port <= 0) {
    return null;
  }
  const containerPort = typeof cport === 'number' && cport > 0 ? cport : null;
  return {
    port,
    containerPort,
    pattern:
      typeof pattern === 'string'
        ? pattern
        : DECLARATIVE_URL_INFRA_DEFAULTS.frontDoorPatternWhenUnspecified
  };
}

module.exports = {
  getUrlsLocalYamlPath,
  readUrlsLocalRegistrySync,
  writeUrlsLocalRegistrySync,
  refreshUrlsLocalRegistryFromBuilder,
  normalizePatternForUrl,
  getRegistryEntryForApp
};
