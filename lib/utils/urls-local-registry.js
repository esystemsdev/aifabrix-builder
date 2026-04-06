/**
 * ~/.aifabrix/urls.local.yaml — per-app port + front-door pattern (plan 122).
 *
 * @fileoverview Read/write registry; scan each builder app folder for application.yaml
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const pathsUtil = require('./paths');

/**
 * @returns {string} Absolute path to urls.local.yaml
 */
function getUrlsLocalYamlPath() {
  return path.join(pathsUtil.getAifabrixHome(), 'urls.local.yaml');
}

/**
 * @returns {Record<string, unknown>}
 */
function readUrlsLocalRegistrySync() {
  const p = getUrlsLocalYamlPath();
  if (!fs.existsSync(p)) {
    return {};
  }
  try {
    const doc = yaml.load(fs.readFileSync(p, 'utf8'));
    return doc && typeof doc === 'object' ? doc : {};
  } catch {
    return {};
  }
}

/**
 * @param {Object} data - Full registry object to write
 */
function writeUrlsLocalRegistrySync(data) {
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
  const port = typeof doc.port === 'number' ? doc.port : null;
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
