/**
 * Primary `urls.local.yaml` beside `config.yaml` (same directory as {@link module:lib/utils/paths.getConfigDirForPaths}),
 * aligned with `secrets.local.yaml`. When missing, {@link readUrlsLocalRegistrySync} may read a legacy
 * file under {@link module:lib/utils/paths.getAifabrixHome} (older releases when `aifabrix-home` was `$HOME`).
 *
 * Per-app keys (see {@link mergeDocIntoRegistry}): `appKey-port`, `appKey-pattern`, `appKey-containerPort`,
 * optional `appKey-internalDockerUseOriginOnly` (boolean) — overrides `frontDoorRouting.internalDockerUseOriginOnly`
 * for declarative `url://` resolution when set (e.g. Keycloak internal URL without `/auth` when true).
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
 * @param {string} cfgPath
 * @returns {number|null}
 */
function tryGetApplicationYamlMtimeMs(cfgPath) {
  try {
    if (!fsRealSync.existsSync(cfgPath)) {
      return null;
    }
    return fsRealSync.statSync(cfgPath).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * @param {string} builderDir
 * @param {import('fs').Dirent} ent
 * @param {number} dirIndex
 * @param {Map<string, { folderName: string, doc: object, mtime: number, dirIndex: number }>} best
 */
function maybeUpdateBestFromAppFolder(builderDir, ent, dirIndex, best) {
  const cfgPath = path.join(builderDir, ent.name, 'application.yaml');
  const mtime = tryGetApplicationYamlMtimeMs(cfgPath);
  if (mtime === null) {
    return;
  }
  const doc = tryLoadApplicationYaml(cfgPath);
  if (!doc) {
    return;
  }
  const appKey = (doc.app && doc.app.key) || ent.name;
  const cur = best.get(appKey);
  if (!cur || mtime > cur.mtime || (mtime === cur.mtime && dirIndex > cur.dirIndex)) {
    best.set(appKey, { folderName: ent.name, doc, mtime, dirIndex });
  }
}

/**
 * @param {string} builderDir
 * @param {number} dirIndex
 * @param {Map<string, { folderName: string, doc: object, mtime: number, dirIndex: number }>} best
 */
function mergeBuilderDirScanIntoBestMap(builderDir, dirIndex, best) {
  if (!builderDir || typeof builderDir !== 'string') {
    return;
  }
  if (!fsRealSync.existsSync(builderDir) || !fsRealSync.statSync(builderDir).isDirectory()) {
    return;
  }
  for (const ent of fsRealSync.readdirSync(builderDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) {
      continue;
    }
    maybeUpdateBestFromAppFolder(builderDir, ent, dirIndex, best);
  }
}

/**
 * When the same app exists under multiple builder roots (e.g. monorepo `builder/<app>` vs
 * materialized `AIFABRIX_BUILDER_DIR/<app>`), pick the `application.yaml` with the newest
 * mtime so `urls.local.yaml` tracks the copy the developer last edited instead of always the last
 * merge order.
 *
 * @param {string[]} scanDirs - Absolute builder (or `packages`) directories, in scan order
 * @returns {Array<{ folderName: string, doc: object }>}
 */
function collectLatestApplicationYamlEntriesPerApp(scanDirs) {
  /** @type {Map<string, { folderName: string, doc: object, mtime: number, dirIndex: number }>} */
  const best = new Map();
  scanDirs.forEach((builderDir, dirIndex) => {
    mergeBuilderDirScanIntoBestMap(builderDir, dirIndex, best);
  });
  return [...best.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => ({ folderName: v.folderName, doc: v.doc }));
}

/**
 * True when getBuilderRoot() resolves to the same path as AIFABRIX_BUILDER_DIR (authoritative override).
 * @param {string|null} resolvedEffective
 * @param {string|null} envResolved
 * @returns {boolean}
 */
function effectiveBuilderMatchesEnvVar(resolvedEffective, envResolved) {
  return Boolean(envResolved && resolvedEffective && resolvedEffective === envResolved);
}

/**
 * Builder dirs to scan (order is a tie-break when two `application.yaml` files share the same mtime;
 * {@link collectLatestApplicationYamlEntriesPerApp} picks the newest file per app key).
 *
 * @param {string} root - Resolved project root passed to refresh
 * @param {string|null} effectiveBuilderDir - pathsUtil.getBuilderRoot()
 * @returns {string[]}
 */
function getOrderedBuilderDirsForRegistryScan(root, effectiveBuilderDir) {
  const legacyBuilderDir = path.join(root, 'builder');
  let resolvedLegacy;
  let resolvedEffective;
  try {
    resolvedLegacy = path.resolve(legacyBuilderDir);
    resolvedEffective = effectiveBuilderDir ? path.resolve(effectiveBuilderDir) : null;
  } catch {
    return [legacyBuilderDir];
  }
  const envRaw = process.env.AIFABRIX_BUILDER_DIR && String(process.env.AIFABRIX_BUILDER_DIR).trim();
  const envResolved = envRaw ? path.resolve(envRaw) : null;
  // Only treat env as authoritative when getBuilderRoot() is actually that path. Otherwise a stray
  // AIFABRIX_BUILDER_DIR on CI (or Jest mocking getBuilderRoot to a temp dir) must not force
  // [legacy, effective] — that order lets the real checkout builder overwrite the mocked root last.
  const effectiveMatchesEnvVar = effectiveBuilderMatchesEnvVar(resolvedEffective, envResolved);

  if (effectiveBuilderDir && resolvedEffective && resolvedEffective === resolvedLegacy) {
    return [legacyBuilderDir];
  }
  if (effectiveMatchesEnvVar && effectiveBuilderDir && resolvedEffective && resolvedEffective !== resolvedLegacy) {
    return [legacyBuilderDir, effectiveBuilderDir];
  }
  if (effectiveBuilderDir && resolvedEffective && resolvedEffective !== resolvedLegacy) {
    return [effectiveBuilderDir, legacyBuilderDir];
  }
  return [legacyBuilderDir];
}

/**
 * @param {string[]} builderDirs
 * @returns {string[]}
 */
function prependSystemBuilderDirWhenPresent(builderDirs) {
  try {
    const sysRoot = pathsUtil.getSystemBuilderRoot();
    const resolvedSys = path.resolve(sysRoot);
    if (!fsRealSync.existsSync(sysRoot)) {
      return builderDirs;
    }
    const resolvedList = builderDirs.map((d) => path.resolve(d));
    if (resolvedList.includes(resolvedSys)) {
      return builderDirs;
    }
    return [sysRoot, ...builderDirs];
  } catch {
    return builderDirs;
  }
}

/**
 * When the CLI package root differs from the repo the user is in (e.g. global `af` from
 * `aifabrix-builder` while cwd is `aifabrix-miso`), {@link pathsUtil.getProjectRoot} may not point at
 * the checkout that contains `builder/<app>/application.yaml`. Append cwd's `builder/` when it is a
 * distinct directory so `urls.local.yaml` can follow edits there.
 *
 * @param {string[]} scanDirs - Mutable list of absolute builder (or packages) dirs
 */
function appendCwdProjectBuilderDirIfDistinct(scanDirs) {
  let cwdRoot = null;
  try {
    cwdRoot = pathsUtil.findProjectRootFromCwd();
  } catch {
    return;
  }
  if (!cwdRoot || typeof cwdRoot !== 'string') {
    return;
  }
  let cwdBuilder = null;
  try {
    cwdBuilder = path.resolve(path.join(cwdRoot, 'builder'));
  } catch {
    return;
  }
  if (!cwdBuilder || !fsRealSync.existsSync(cwdBuilder) || !fsRealSync.statSync(cwdBuilder).isDirectory()) {
    return;
  }
  const resolvedList = scanDirs.filter(Boolean).map((d) => {
    try {
      return path.resolve(d);
    } catch {
      return null;
    }
  });
  if (resolvedList.includes(cwdBuilder)) {
    return;
  }
  scanDirs.push(cwdBuilder);
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
 * Merge scan results into registry (does not remove stale keys).
 * @param {string|null} projectRoot - getProjectRoot() or null (same semantics as projectRoot || getProjectRoot())
 * @returns {Object} Updated registry
 */
function refreshUrlsLocalRegistryFromBuilder(projectRoot) {
  const root = projectRoot || pathsUtil.getProjectRoot();
  const merged = { ...readUrlsLocalRegistrySync() };
  if (!root) {
    return writeMergedRegistry(merged);
  }
  // Published npm tarball omits builder/ under the package root (.npmignore). Global installs must
  // still refresh from the real builder tree (AIFABRIX_BUILDER_DIR or integration base + builder).
  let effectiveBuilderDir = null;
  try {
    effectiveBuilderDir = pathsUtil.getBuilderRoot();
  } catch {
    effectiveBuilderDir = null;
  }
  let builderDirs = getOrderedBuilderDirsForRegistryScan(root, effectiveBuilderDir);
  builderDirs = prependSystemBuilderDirWhenPresent(builderDirs);
  const scanDirs = [...builderDirs, ...getPackageBuilderLikeDirsForRegistryScan()];
  appendCwdProjectBuilderDirIfDistinct(scanDirs);
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
