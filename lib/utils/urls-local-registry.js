/**
 * Primary `urls.local.yaml` beside `config.yaml` (same directory as {@link module:lib/utils/paths.getConfigDirForPaths}),
 * aligned with `secrets.local.yaml`. When missing, {@link readUrlsLocalRegistrySync} may read a legacy
 * file under {@link module:lib/utils/paths.getAifabrixHome} (older releases when `aifabrix-home` was `$HOME`).
 *
 * Per-app keys (see {@link mergeDocIntoRegistry}): `appKey-port`, `appKey-pattern`, `appKey-containerPort`,
 * optional `appKey-internalDockerUseOriginOnly` (boolean) — overrides `frontDoorRouting.internalDockerUseOriginOnly`
 * for declarative `url://` resolution when set (e.g. Keycloak internal URL without `/auth` when true).
 *
 * @fileoverview Read/write registry; scan builder/package dirs in canonical order (plan 141 P3).
 *   Duplicate `app.key`: last scan directory wins — no cross-root mtime merge or `AIFABRIX_BUILDER_DIR` ordering.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const fsRealSync = require('../internal/fs-real-sync');
const path = require('path');
const yaml = require('js-yaml');
const { DECLARATIVE_URL_INFRA_DEFAULTS } = require('./infra-env-defaults');
const pathsUtil = require('./paths');
const { collectLatestApplicationYamlEntriesPerApp } = require('./urls-local-registry-scan');

/**
 * @returns {string} Absolute path to urls.local.yaml (beside config.yaml)
 */
function getUrlsLocalYamlPath() {
  return path.join(pathsUtil.getConfigDirForPaths(), 'urls.local.yaml');
}

/** @returns {string} Legacy primary path from older CLI (under resolved AI Fabrix home) */
function getLegacyUrlsLocalYamlPathAtAifabrixHome() {
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
  const legacy = getLegacyUrlsLocalYamlPathAtAifabrixHome();
  if (path.resolve(legacy) !== path.resolve(primary) && fsRealSync.existsSync(legacy)) {
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

  mergeInternalDockerOriginOnlyRegistryKeyFromDoc(merged, appKey, doc);
}

/**
 * When `application.yaml` explicitly sets `frontDoorRouting.internalDockerUseOriginOnly`, mirror it into
 * `urls.local.yaml` on refresh. If the property is absent, leave any existing registry value unchanged
 * (supports hand-edited `appKey-internalDockerUseOriginOnly` without a YAML field).
 *
 * @param {Object} merged
 * @param {string} appKey
 * @param {object} doc
 */
function mergeInternalDockerOriginOnlyRegistryKeyFromDoc(merged, appKey, doc) {
  const key = `${appKey}-internalDockerUseOriginOnly`;
  const fd = doc && doc.frontDoorRouting;
  if (!fd || typeof fd !== 'object') {
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(fd, 'internalDockerUseOriginOnly')) {
    return;
  }
  const v = fd.internalDockerUseOriginOnly;
  if (v === true) {
    merged[key] = true;
  } else if (v === false) {
    merged[key] = false;
  } else {
    delete merged[key];
  }
}

/**
 * Append a directory to the scan list when it exists, is a directory, and is not already included (resolved).
 * Later entries win duplicate `app.key` merges (see {@link collectLatestApplicationYamlEntriesPerApp}).
 *
 * @param {string[]} scanDirs
 * @param {string|null|undefined} dirPath
 * @returns {void}
 */
function pushUniqueScanDir(scanDirs, dirPath) {
  if (!dirPath || typeof dirPath !== 'string') {
    return;
  }
  let resolved;
  try {
    resolved = path.resolve(dirPath);
  } catch {
    return;
  }
  try {
    if (!fsRealSync.existsSync(resolved) || !fsRealSync.statSync(resolved).isDirectory()) {
      return;
    }
  } catch {
    return;
  }
  for (const existing of scanDirs) {
    try {
      if (path.resolve(existing) === resolved) {
        return;
      }
    } catch {
      // ignore
    }
  }
  scanDirs.push(resolved);
}

/**
 * @returns {string[]}
 */
function getPackageBuilderLikeDirsForRegistryScan() {
  const out = [];
  try {
    out.push(path.join(pathsUtil.getIntegrationBuilderBaseDir(), 'packages'));
  } catch {
    // ignore
  }
  try {
    const pr = pathsUtil.getProjectRoot();
    if (pr) {
      out.push(path.join(pr, 'packages'));
    }
  } catch {
    // ignore
  }
  return out;
}

/**
 * Canonical builder/package scan roots (low → high priority). Plan 141 P3: fixed order replaces
 * mtime merge and `AIFABRIX_BUILDER_DIR` scan ordering; `findProjectRootFromCwd` builder is last when enabled.
 *
 * @param {string|null} root
 * @param {string|null} effectiveBuilderDir
 * @param {{ excludeCwdBuilderScan?: boolean }} opts
 * @returns {string[]}
 */
function buildCanonicalRegistryScanDirs(root, effectiveBuilderDir, opts = {}) {
  const scanDirs = [];
  pushUniqueScanDir(scanDirs, pathsUtil.getSystemBuilderRoot());
  pushUniqueScanDir(scanDirs, effectiveBuilderDir);
  if (root) {
    pushUniqueScanDir(scanDirs, path.join(root, 'builder'));
  }
  for (const pkg of getPackageBuilderLikeDirsForRegistryScan()) {
    pushUniqueScanDir(scanDirs, pkg);
  }
  if (!opts.excludeCwdBuilderScan) {
    let cwdRoot = null;
    try {
      cwdRoot = pathsUtil.findProjectRootFromCwd();
    } catch {
      cwdRoot = null;
    }
    if (cwdRoot && typeof cwdRoot === 'string') {
      pushUniqueScanDir(scanDirs, path.join(cwdRoot, 'builder'));
    }
  }
  return scanDirs;
}

/**
 * Merge scan results into registry (does not remove stale keys).
 * @param {string|null} projectRoot - getProjectRoot() or null (same semantics as projectRoot || getProjectRoot())
 * @param {{ excludeCwdBuilderScan?: boolean }} [opts] - When `excludeCwdBuilderScan` is true, omit cwd
 *   checkout `builder/` (tests / `ctx.projectRoot` isolation — avoids merging ambient repo `builder/`).
 * @returns {Object} Updated registry
 */
function refreshUrlsLocalRegistryFromBuilder(projectRoot, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const root = projectRoot || pathsUtil.getProjectRoot();
  const merged = { ...readUrlsLocalRegistrySync() };
  if (!root) {
    return writeMergedRegistry(merged);
  }
  // Published npm tarball omits builder/ under the package root (.npmignore). Global installs still
  // resolve materialized apps via getBuilderRoot() (same parent as getSystemBuilderRoot when aligned).
  let effectiveBuilderDir = null;
  try {
    effectiveBuilderDir = pathsUtil.getBuilderRoot();
  } catch {
    effectiveBuilderDir = null;
  }
  const scanDirs = buildCanonicalRegistryScanDirs(root, effectiveBuilderDir, o);
  const entries = collectLatestApplicationYamlEntriesPerApp(scanDirs);
  for (const { folderName, doc } of entries) {
    mergeDocIntoRegistry(merged, doc, folderName);
  }
  return writeMergedRegistry(merged);
}

const REGISTRY_BOOL_TRUE = new Set([true, 'true', 'yes', 'on', 1, '1']);
const REGISTRY_BOOL_FALSE = new Set([false, 'false', 'no', 'off', 0, '0']);

/**
 * @param {unknown} raw
 * @returns {boolean|undefined}
 */
function coerceRegistryBool(raw) {
  if (REGISTRY_BOOL_TRUE.has(raw)) {
    return true;
  }
  if (REGISTRY_BOOL_FALSE.has(raw)) {
    return false;
  }
  return undefined;
}

/**
 * Optional `appKey-internalDockerUseOriginOnly` in `urls.local.yaml` (boolean or common string coercions).
 * When set, declarative URL resolution uses this value instead of (or in addition to) `application.yaml`.
 *
 * @param {string} appKey
 * @param {Object|null|undefined} registry
 * @returns {boolean|undefined} undefined when the key is absent or not coercible to boolean
 */
function readRegistryInternalDockerUseOriginOnly(appKey, registry) {
  const r = registry && typeof registry === 'object' ? registry : {};
  const key = `${appKey}-internalDockerUseOriginOnly`;
  if (!Object.prototype.hasOwnProperty.call(r, key)) {
    return undefined;
  }
  return coerceRegistryBool(r[key]);
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
  getRegistryEntryForApp,
  readRegistryInternalDockerUseOriginOnly
};
