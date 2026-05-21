/**
 * @fileoverview Resolve protection manifests by datasource key under `integration/.protection/`.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { getProtectionRoot } = require('./paths');
const { loadProtectionManifest } = require('./load');

const PROTECTION_FILENAME_RE = /^([a-z0-9][a-z0-9-]*)-protection-([a-z0-9][a-z0-9-]*)$/i;

/**
 * @param {string} root
 * @param {string} candidate
 * @returns {boolean}
 */
function isPathInsideRoot(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`);
}

/**
 * @param {string} stem
 * @returns {string|null}
 */
function datasourceKeyFromProtectionFilename(stem) {
  const m = PROTECTION_FILENAME_RE.exec(stem);
  if (!m) {
    return null;
  }
  return `${m[1]}-${m[2]}`;
}

/**
 * @param {string} root
 * @returns {string[]}
 */
function listProtectionManifestPaths(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs
    .readdirSync(root)
    .filter((name) => /\.(yaml|yml|json)$/i.test(name))
    .map((name) => path.join(root, name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * @param {string} root
 * @throws {Error}
 */
function assertNoDuplicateDatasourceKeys(root) {
  const seen = new Map();
  for (const filePath of listProtectionManifestPaths(root)) {
    let manifest;
    try {
      manifest = loadProtectionManifest(filePath);
    } catch {
      continue;
    }
    const ds = String(manifest?.spec?.datasourceKey || '').trim();
    if (!ds) {
      continue;
    }
    if (seen.has(ds)) {
      throw new Error(
        `Duplicate spec.datasourceKey "${ds}" in .protection/ (${seen.get(ds)} and ${filePath})`
      );
    }
    seen.set(ds, filePath);
  }
}

/**
 * @param {Object} manifest
 * @param {string} key
 * @param {string} location
 */
function assertManifestDatasourceKey(manifest, key, location) {
  const specKey = String(manifest?.spec?.datasourceKey || '').trim();
  if (specKey && specKey !== key) {
    throw new Error(`spec.datasourceKey "${specKey}" does not match CLI argument "${key}"${location}`);
  }
}

/**
 * @param {string} key
 * @param {string} manifestPath
 * @param {Object} manifest
 */
function protectionManifestResult(key, manifestPath, manifest) {
  assertManifestDatasourceKey(manifest, key, ` in ${manifestPath}`);
  return { datasourceKey: key, manifestPath, manifest };
}

/**
 * @param {string} key
 * @param {string} root
 * @returns {string[]}
 */
function collectProtectionManifestMatches(key, root) {
  const matches = [];
  for (const filePath of listProtectionManifestPaths(root)) {
    const stem = path.basename(filePath, path.extname(filePath));
    if (stem === key || datasourceKeyFromProtectionFilename(stem) === key) {
      matches.push(filePath);
      continue;
    }
    try {
      const manifest = loadProtectionManifest(filePath);
      if (String(manifest?.spec?.datasourceKey || '').trim() === key) {
        matches.push(filePath);
      }
    } catch {
      /* skip unreadable */
    }
  }
  return matches;
}

/**
 * @param {string} datasourceKey
 * @param {string} [explicitPath]
 * @returns {{ datasourceKey: string, manifestPath: string, manifest: Object }}
 */
function resolveProtectionManifest(datasourceKey, explicitPath) {
  const key = String(datasourceKey || '').trim();
  if (!key) throw new Error('Datasource key is required');

  const root = getProtectionRoot();
  assertNoDuplicateDatasourceKeys(root);

  if (explicitPath) {
    const manifestPath = path.resolve(explicitPath);
    if (!isPathInsideRoot(root, manifestPath)) {
      throw new Error(`Protection path must be under ${root}`);
    }
    return protectionManifestResult(key, manifestPath, loadProtectionManifest(manifestPath));
  }

  for (const ext of ['.yaml', '.yml', '.json']) {
    const preferred = path.join(root, `${key}${ext}`);
    if (fs.existsSync(preferred)) {
      return protectionManifestResult(key, preferred, loadProtectionManifest(preferred));
    }
  }

  const matches = collectProtectionManifestMatches(key, root);
  if (matches.length === 0) {
    throw new Error(
      `No protection manifest for datasource "${key}" under ${root}. Expected ${key}.yaml or ${key}.json`
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous protection manifest for "${key}": ${matches.map((p) => path.basename(p)).join(', ')}`
    );
  }

  const manifestPath = matches[0];
  return protectionManifestResult(key, manifestPath, loadProtectionManifest(manifestPath));
}

/**
 * @param {string} arg - CLI positional (datasource key or file path)
 * @returns {{ datasourceKey: string, manifestPath: string, manifest: Object }}
 */
function resolveProtectionArgument(arg) {
  const raw = String(arg || '').trim();
  if (!raw) {
    throw new Error('Datasource key is required');
  }
  const root = getProtectionRoot();
  const asPath = path.resolve(raw);
  if (fs.existsSync(asPath) && fs.statSync(asPath).isFile()) {
    if (!isPathInsideRoot(root, asPath)) {
      throw new Error(`Protection file must be under ${root}`);
    }
    const manifest = loadProtectionManifest(asPath);
    const ds = String(manifest?.spec?.datasourceKey || '').trim();
    if (!ds) {
      throw new Error('Manifest spec.datasourceKey is required');
    }
    return resolveProtectionManifest(ds, asPath);
  }
  return resolveProtectionManifest(raw);
}

module.exports = {
  resolveProtectionManifest,
  resolveProtectionArgument,
  listProtectionManifestPaths,
  datasourceKeyFromProtectionFilename,
  isPathInsideRoot,
  assertNoDuplicateDatasourceKeys
};
