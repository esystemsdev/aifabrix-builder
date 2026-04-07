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

const { nodeFs } = require('../internal/node-fs');
const path = require('path');
const yaml = require('js-yaml');
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
  const fs = nodeFs();
  try {
    const doc = yaml.load(fs.readFileSync(filePath, 'utf8'));
    return doc && typeof doc === 'object' ? doc : {};
  } catch {
    return {};
  }
}

/**
 * @returns {Record<string, unknown>}
 */
function readUrlsLocalRegistrySync() {
  const fs = nodeFs();
  const primary = getUrlsLocalYamlPath();
  if (fs.existsSync(primary)) {
    return loadRegistryYamlFile(primary);
  }
  const legacy = getLegacyUrlsLocalYamlPath();
  if (legacy !== primary && fs.existsSync(legacy)) {
    return loadRegistryYamlFile(legacy);
  }
  return {};
}

/**
 * @param {Object} data - Full registry object to write
 */
function writeUrlsLocalRegistrySync(data) {
  const fs = nodeFs();
  const p = getUrlsLocalYamlPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const body = `${yaml.dump(data, { lineWidth: 120, noRefs: true }).trim()}\n`;
  fs.writeFileSync(p, body, { mode: 0o600 });
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
  const fs = nodeFs();
  if (!fs.existsSync(cfgPath)) {
    return null;
  }
  try {
    const doc = yaml.load(fs.readFileSync(cfgPath, 'utf8'));
    return doc && typeof doc === 'object' ? doc : null;
  } catch {
    return null;
  }
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
  const pattern = typeof rawPattern === 'string' ? rawPattern : '/';
  merged[`${appKey}-port`] = port;
  merged[`${appKey}-pattern`] = pattern;
}

/**
 * Merge scan results into registry (does not remove stale keys).
 * @param {string|null} projectRoot - getProjectRoot() or null
 * @returns {Object} Updated registry
 */
function refreshUrlsLocalRegistryFromBuilder(projectRoot) {
  const fs = nodeFs();
  const root = projectRoot || pathsUtil.getProjectRoot();
  const merged = { ...readUrlsLocalRegistrySync() };
  if (!root) {
    return writeMergedRegistry(merged);
  }
  const builderDir = path.join(root, 'builder');
  if (!fs.existsSync(builderDir) || !fs.statSync(builderDir).isDirectory()) {
    return writeMergedRegistry(merged);
  }
  for (const ent of fs.readdirSync(builderDir, { withFileTypes: true })) {
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
 * @returns {{ port: number, pattern: string }|null}
 */
function getRegistryEntryForApp(appKey, registry) {
  const r = registry || {};
  const portKey = `${appKey}-port`;
  const patKey = `${appKey}-pattern`;
  const port = r[portKey];
  const pattern = r[patKey];
  if (typeof port !== 'number' || port <= 0) {
    return null;
  }
  return {
    port,
    pattern: typeof pattern === 'string' ? pattern : '/'
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
