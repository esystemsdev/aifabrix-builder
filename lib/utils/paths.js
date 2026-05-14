/**
 * Path Utilities for AI Fabrix Builder
 * Centralized helpers for resolving filesystem locations with AIFABRIX_HOME override.
 * @fileoverview Path resolution utilities with environment overrides
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-lines -- Central path resolution; resolveIntegrationAppKeyFromCwd for datasource commands */

'use strict';

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { nodeFs } = require('../internal/node-fs');
const {
  getAifabrixRuntimeConfigDir,
  resolveAifabrixHomeLikePath
} = require('./aifabrix-runtime-config-dir');
const { resolveSystemBuilderParentDir } = require('./system-builder-root');

function safeHomedir() {
  try {
    const osMod = require('os');
    if (typeof osMod.homedir === 'function') {
      const hd = osMod.homedir();
      if (typeof hd === 'string' && hd.length > 0) {
        return hd;
      }
    }
  } catch {
    // ignore
  }
  return process.env.HOME || process.env.USERPROFILE || '/';
}

/**
 * Returns the path to the config directory (same as {@link getAifabrixRuntimeConfigDir} / config.js).
 * When `AIFABRIX_HOME` is `$HOME` but `config.yaml` is only under `$HOME/.aifabrix/`, returns the latter.
 * @returns {string} Absolute path to config directory
 */
function getConfigDirForPaths() {
  return getAifabrixRuntimeConfigDir();
}

/**
 * User-owned `secrets.local.yaml` beside `config.yaml` (same directory as {@link getConfigDirForPaths}).
 * When `aifabrix-home` is the POSIX home (e.g. `/home/user`), secrets stay under `~/.aifabrix/`, not
 * in the home root. {@link getAifabrixHome} remains for applications base, builder parent, and
 * legacy secrets migration reads in {@link module:lib/utils/secrets-utils}.
 *
 * @returns {string} Absolute path to secrets.local.yaml
 */
function getPrimaryUserSecretsLocalPath() {
  return path.join(getConfigDirForPaths(), 'secrets.local.yaml');
}

/**
 * Directory for CLI system state next to `config.yaml`: `admin-secrets.env`, `infra/` or `infra-dev{id}/`,
 * `audit.log`, etc. Unlike {@link getAifabrixHome}, this follows the resolved config directory (e.g.
 * `~/.aifabrix` when config lives there even if `aifabrix-home` / `AIFABRIX_HOME` is `$HOME`).
 *
 * @returns {string} Absolute path (same as {@link getConfigDirForPaths})
 */
function getAifabrixSystemDir() {
  return getConfigDirForPaths();
}

/**
 * Returns the base AI Fabrix directory.
 * Priority: AIFABRIX_HOME env → config.yaml `aifabrix-home` → ~/.aifabrix.
 * Builder-server SSH provisioning sets `aifabrix-home` to the user POSIX home; dev `.bashrc` exports AIFABRIX_HOME from that key (default $HOME).
 *
 * @returns {string} Absolute path to the AI Fabrix home directory
 */
function getAifabrixHome() {
  if (process.env.AIFABRIX_HOME && typeof process.env.AIFABRIX_HOME === 'string') {
    return resolveAifabrixHomeLikePath(process.env.AIFABRIX_HOME.trim());
  }
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  if (!isTestEnv) {
    try {
      const configDir = getConfigDirForPaths();
      const configPath = path.join(configDir, 'config.yaml');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(content) || {};
        const homeOverride = config && typeof config['aifabrix-home'] === 'string' ? config['aifabrix-home'].trim() : '';
        if (homeOverride) {
          return resolveAifabrixHomeLikePath(homeOverride);
        }
      }
    } catch {
      // Ignore errors and fall back to default
    }
  }
  return path.join(safeHomedir(), '.aifabrix');
}

/**
 * Default git / workspace root from env or config (optional; no fallback to aifabrix-home).
 * Priority: AIFABRIX_WORK env (trim, resolve) → config.yaml `aifabrix-work` → null.
 *
 * @returns {string|null} Absolute path or null when unset
 */
function getAifabrixWork() {
  if (process.env.AIFABRIX_WORK && typeof process.env.AIFABRIX_WORK === 'string') {
    const t = process.env.AIFABRIX_WORK.trim();
    if (t) {
      return resolveAifabrixHomeLikePath(t);
    }
  }
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  if (!isTestEnv) {
    try {
      const configDir = getConfigDirForPaths();
      const configPath = path.join(configDir, 'config.yaml');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(content) || {};
        const workOverride =
          config && typeof config['aifabrix-work'] === 'string' ? config['aifabrix-work'].trim() : '';
        if (workOverride) {
          return resolveAifabrixHomeLikePath(workOverride);
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

// Cache project root to avoid repeated filesystem lookups
let cachedProjectRoot = null;

/**
 * Clears the cached project root
 * Useful in tests when global.PROJECT_ROOT changes
 */
function clearProjectRootCache() {
  cachedProjectRoot = null;
}

/**
 * Checks if a directory contains package.json
 * @param {string} dirPath - Directory path to check
 * @returns {boolean} True if package.json exists
 */
function hasPackageJson(dirPath) {
  const packageJsonPath = path.join(dirPath, 'package.json');
  // Real disk: Jest workers may retain jest.mock('fs') from other suites; project root must stay truthful.
  return nodeFs().existsSync(packageJsonPath);
}

/**
 * Strategy 1: Walk up from a starting directory to find package.json
 * @param {string} startDir - Starting directory
 * @param {number} maxDepth - Maximum depth to search
 * @returns {string|null} Project root path or null if not found
 */
function findProjectRootByWalkingUp(startDir, maxDepth = 10) {
  let currentDir = startDir;
  for (let i = 0; i < maxDepth; i++) {
    if (hasPackageJson(currentDir)) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }
  return null;
}

/**
 * Strategy 2: Try from process.cwd()
 * @returns {string|null} Project root path or null if not found
 */
function findProjectRootFromCwd() {
  try {
    const cwd = process.cwd();
    if (cwd && cwd !== '/' && hasPackageJson(cwd)) {
      return cwd;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Strategy 3: Check if Jest rootDir is available
 * @returns {string|null} Project root path or null if not found
 */
// eslint-disable-next-line no-unused-vars
function _findProjectRootFromJest() {
  if (typeof jest !== 'undefined' && jest.config && jest.config.rootDir) {
    const jestRoot = jest.config.rootDir;
    if (hasPackageJson(jestRoot)) {
      return jestRoot;
    }
  }
  return null;
}

/**
 * Strategy 4: Fallback to __dirname relative path
 * @returns {string} Fallback project root path
 */
function getFallbackProjectRoot() {
  return path.resolve(__dirname, '..', '..');
}

/**
 * Checks if global PROJECT_ROOT is valid
 * @returns {string|null} Valid global root or null
 */
function checkGlobalProjectRoot() {
  if (typeof global === 'undefined' || !global.PROJECT_ROOT) {
    return null;
  }

  const globalRoot = global.PROJECT_ROOT;
  if (!hasPackageJson(globalRoot)) {
    return null;
  }

  // In test environment, allow temp dir as project root (Jest sets NODE_ENV=test / JEST_WORKER_ID)
  const isTestEnv = process.env.NODE_ENV === 'test' || typeof process.env.JEST_WORKER_ID !== 'undefined';
  if (isTestEnv) {
    return globalRoot;
  }

  // Verify that __dirname is actually within globalRoot
  const dirnameNormalized = path.resolve(__dirname);
  const globalRootNormalized = path.resolve(globalRoot);
  const isWithinGlobalRoot = dirnameNormalized.startsWith(globalRootNormalized + path.sep) ||
                            dirnameNormalized === globalRootNormalized;

  return isWithinGlobalRoot ? globalRoot : null;
}

/**
 * Tries different strategies to find project root
 * @returns {string} Found project root
 */
function tryFindProjectRoot() {
  const globalRoot = checkGlobalProjectRoot();
  if (globalRoot) {
    cachedProjectRoot = globalRoot;
    return cachedProjectRoot;
  }
  const foundRoot = findProjectRootByWalkingUp(__dirname);
  if (foundRoot && hasPackageJson(foundRoot)) {
    cachedProjectRoot = foundRoot;
    return cachedProjectRoot;
  }
  const cwdRoot = findProjectRootFromCwd();
  if (cwdRoot && hasPackageJson(cwdRoot)) {
    cachedProjectRoot = cwdRoot;
    return cachedProjectRoot;
  }
  const fallbackRoot = getFallbackProjectRoot();
  if (hasPackageJson(fallbackRoot)) {
    cachedProjectRoot = fallbackRoot;
    return cachedProjectRoot;
  }
  cachedProjectRoot = fallbackRoot;
  return cachedProjectRoot;
}

function getProjectRoot() {
  // Prefer global.PROJECT_ROOT whenever it is valid so tests that override it (or restore it)
  // are not defeated by a stale cachedProjectRoot from an earlier call in the same Jest worker.
  const globalRoot = checkGlobalProjectRoot();
  if (globalRoot) {
    cachedProjectRoot = globalRoot;
    return globalRoot;
  }
  if (cachedProjectRoot && hasPackageJson(cachedProjectRoot)) {
    return cachedProjectRoot;
  }
  return tryFindProjectRoot();
}

/**
 * Returns the applications base directory next to effective `config.yaml` (same root as infra, secrets, audit).
 * Dev 0: `<configDir>/applications`; non-zero dev: `<configDir>/applications-dev-{id}`.
 * Uses {@link getAifabrixSystemDir}, not raw {@link getAifabrixHome}, so builder-server layouts with
 * `AIFABRIX_HOME=$HOME` and config under `~/.aifabrix/` keep apps under `.aifabrix` (not `$HOME/applications-dev-*`).
 *
 * @param {number|string} developerId - Developer ID
 * @returns {string} Absolute path to applications base directory
 */
function getApplicationsBaseDir(developerId) {
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  const base = getAifabrixSystemDir();
  if (idNum === 0) {
    return path.join(base, 'applications');
  }
  return path.join(base, `applications-dev-${developerId}`);
}

/**
 * Returns the developer-specific application directory. Dev 0: applications/; Dev > 0: applications-dev-{id}
 * @param {string} appName - Application name
 * @param {number|string} developerId - Developer ID
 * @returns {string} Developer-specific app directory (root)
 */
function getDevDirectory(appName, developerId) {
  const baseDir = getApplicationsBaseDir(developerId);
  return baseDir;
}

/**
 * Gets the application path (builder or integration folder).
 * Matches {@link getBuilderPath} / {@link getIntegrationPath} (cwd `integration/` / `builder/`, then
 * material `(aifabrix-work | aifabrix-home)` trees).
 * @param {string} appName - Application name
 * @param {string} [appType] - Application type ('external' or other)
 * @returns {string} Absolute path to application directory
 */
function getAppPath(appName, appType) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  if (appType === 'external') {
    return module.exports.getIntegrationPath(appName);
  }
  return module.exports.getBuilderPath(appName);
}

/**
 * Apps materialization / default repo root: **`aifabrix-work`** (or `AIFABRIX_WORK`) when set, else
 * {@link getAifabrixHome}. Used for `integration/` and `builder/` under that parent (not the CLI
 * install tree). Aligns with setup / `up-platform` / `up-miso` / `up-dataplane` template targets.
 *
 * @returns {string} Absolute directory (no trailing `integration/` or `builder/`)
 */
function getAppsMaterializationParent() {
  const work = getAifabrixWork();
  if (work) {
    return path.resolve(work);
  }
  return path.resolve(getAifabrixHome());
}

/**
 * Base directory for legacy callers that meant “non-cwd app tree”: same as {@link getAppsMaterializationParent}.
 *
 * @returns {string}
 */
function getIntegrationBuilderBaseDir() {
  return getAppsMaterializationParent();
}

/**
 * Returns the default integration root under {@link getAppsMaterializationParent} (listing may also
 * scan {@link getCwdIntegrationRoot}; see {@link listIntegrationAppNames}).
 *
 * @returns {string} Absolute path to integration/ directory
 */
function getIntegrationRoot() {
  return path.join(getAppsMaterializationParent(), 'integration');
}

/**
 * Absolute `integration/` next to {@link process.cwd} when that directory exists.
 *
 * @returns {string|null}
 */
function getCwdIntegrationRoot() {
  const p = path.join(path.resolve(process.cwd()), 'integration');
  try {
    if (nodeFs().existsSync(p)) {
      const st = nodeFs().statSync(p);
      if (st && typeof st.isDirectory === 'function' && st.isDirectory()) {
        return p;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Absolute `builder/` next to {@link process.cwd} when that directory exists.
 *
 * @returns {string|null}
 */
function getCwdBuilderRoot() {
  const p = path.join(path.resolve(process.cwd()), 'builder');
  try {
    if (nodeFs().existsSync(p)) {
      const st = nodeFs().statSync(p);
      if (st && typeof st.isDirectory === 'function' && st.isDirectory()) {
        return p;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Returns the material `builder/` root: {@link getAppsMaterializationParent}`/builder`
 * (same as {@link getSystemBuilderRoot}). Does not use `AIFABRIX_BUILDER_DIR` — app paths follow
 * cwd + `integration/` / `builder/` or this root only.
 *
 * @returns {string} Absolute path to builder/ directory
 */
function getBuilderRoot() {
  return path.join(getAppsMaterializationParent(), 'builder');
}

/**
 * Platform system apps (`up-platform` / `up-miso` / `up-dataplane` / `setup`): materialize under
 * {@link getSystemBuilderRoot} (= {@link getAppsMaterializationParent}`/builder`), never the global CLI package tree.
 * @readonly
 */
const SYSTEM_BUILDER_APP_KEYS = Object.freeze(['keycloak', 'miso-controller', 'dataplane']);

/**
 * @param {string} appName
 * @returns {boolean}
 */
function isSystemBuilderAppName(appName) {
  if (!appName || typeof appName !== 'string') return false;
  return SYSTEM_BUILDER_APP_KEYS.includes(appName);
}

/**
 * `builder/<appName>` under {@link getAppsMaterializationParent} (same tree as {@link getSystemBuilderRoot}).
 *
 * @param {string} appName
 * @returns {string}
 */
function getProjectBuilderAppPath(appName) {
  return path.join(getIntegrationBuilderBaseDir(), 'builder', appName);
}

/**
 * Same parent as {@link getAppsMaterializationParent} (exported for diagnostics / allowlist checks).
 *
 * @returns {string} Absolute path (no trailing `builder/`)
 */
function getSystemPlatformMaterializationParent() {
  return getAppsMaterializationParent();
}

/**
 * Default `builder/` root for materialized platform apps and Tier‑2 manifest discovery:
 * {@link getAppsMaterializationParent}`/builder`.
 *
 * @returns {string}
 */
function getSystemBuilderRoot() {
  return path.join(getAppsMaterializationParent(), 'builder');
}

/**
 * True when `projectAppPath` is a directory that contains a resolvable application config
 * (`application.yaml` / `.json` / legacy `variables.yaml`). Empty `builder/<platformApp>`
 * stubs must not win over {@link getSystemBuilderRoot} or secrets/run would read the wrong tree
 * (missing `env.template` → skipped ensure → "Missing secrets" on first platform boot).
 *
 * @param {string} projectAppPath - Absolute `.../builder/<app>`
 * @returns {boolean}
 */
function isProjectBuilderAppDirectory(projectAppPath) {
  try {
    if (!projectAppPath || !nodeFs().existsSync(projectAppPath)) return false;
    const st = nodeFs().statSync(projectAppPath);
    if (!st || typeof st.isDirectory !== 'function' || !st.isDirectory()) return false;
    const { resolveApplicationConfigPath } = require('./app-config-resolver');
    resolveApplicationConfigPath(projectAppPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * True when name under root is a real directory (follows symlinks). False for broken symlinks, files, ENOENT.
 * @param {string} root - Parent directory (must exist)
 * @param {string} name - Entry from readdir
 * @returns {boolean}
 */
function isAppSubdirSync(root, name) {
  if (!name || name.startsWith('.')) return false;
  const fullPath = path.join(root, name);
  try {
    const st = nodeFs().statSync(fullPath);
    return Boolean(st && typeof st.isDirectory === 'function' && st.isDirectory());
  } catch {
    return false;
  }
}

/**
 * Lists app names (directories) under integration root. Excludes dot-prefixed entries.
 * Returns [] if root does not exist.
 * @returns {string[]} Sorted list of app directory names
 */
function listIntegrationAppNames() {
  const disk = nodeFs();
  const names = new Set();
  const cwdRoot = getCwdIntegrationRoot();
  if (cwdRoot) {
    addBuilderSubdirNamesToSet(disk, cwdRoot, names, null);
  }
  const matInt = getIntegrationRoot();
  addBuilderSubdirNamesToSet(disk, matInt, names, null);
  return [...names].sort();
}

/**
 * Adds immediate subdirectory names under a builder root into `names` (real disk via {@link nodeFs}).
 * @param {ReturnType<typeof nodeFs>} disk
 * @param {string} builderRootDir
 * @param {Set<string>} names
 * @param {(name: string) => boolean} [nameFilter] - When set, only names passing this filter (after dir check)
 */
function addBuilderSubdirNamesToSet(disk, builderRootDir, names, nameFilter) {
  if (!builderRootDir || !disk.existsSync(builderRootDir)) return;
  let st;
  try {
    st = disk.statSync(builderRootDir);
  } catch {
    return;
  }
  if (!st || typeof st.isDirectory !== 'function' || !st.isDirectory()) return;
  try {
    for (const name of disk.readdirSync(builderRootDir)) {
      if (!isAppSubdirSync(builderRootDir, name)) continue;
      if (nameFilter && !nameFilter(name)) continue;
      names.add(name);
    }
  } catch {
    // ignore
  }
}

/**
 * Lists app names (directories) under builder roots. Excludes dot-prefixed entries.
 * Merges `cwd/builder` and material `(aifabrix-work | aifabrix-home)/builder` (deduped).
 * @returns {string[]} Sorted list of app directory names
 */
function listBuilderAppNames() {
  const disk = nodeFs();
  const names = new Set();
  const roots = new Set();
  const cwdRoot = getCwdBuilderRoot();
  if (cwdRoot) {
    roots.add(path.resolve(cwdRoot));
  }
  roots.add(path.resolve(getSystemBuilderRoot()));
  for (const r of roots) {
    addBuilderSubdirNamesToSet(disk, r, names, null);
  }
  return [...names].sort();
}

/**
 * Gets the integration folder path: **`cwd/integration/<appName>`** when that directory exists, else
 * **`aifabrix-work` or `aifabrix-home` + `/integration/<appName>`**.
 *
 * @param {string} appName - Application name
 * @returns {string} Absolute path to integration directory
 */
function getIntegrationPath(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  const cwdInt = path.join(path.resolve(process.cwd()), 'integration', appName);
  try {
    if (nodeFs().existsSync(cwdInt)) {
      const st = nodeFs().statSync(cwdInt);
      if (st && typeof st.isDirectory === 'function' && st.isDirectory()) {
        return cwdInt;
      }
    }
  } catch {
    // ignore
  }
  return path.join(getAppsMaterializationParent(), 'integration', appName);
}

/**
 * Resolves build.context from application.yaml to an absolute path.
 * Used as the canonical app code directory for local mount and (when remote) Mutagen local path.
 *
 * @param {string} configDir - Directory containing the application config (e.g. builder/<appKey>/)
 * @param {string} [buildContext='.'] - build.context value (relative to configDir)
 * @returns {string} Absolute path to the app code directory
 */
function resolveBuildContext(configDir, buildContext) {
  const dir = (configDir && typeof configDir === 'string') ? configDir : '';
  const ctx = (buildContext && typeof buildContext === 'string') ? buildContext : '.';
  return path.resolve(dir, ctx);
}

/**
 * `cwd/builder/<appName>` when present as a directory and allowed (platform empty stubs skipped).
 *
 * @param {string} appName
 * @returns {string|null}
 */
function tryCwdBuilderPathOrNull(appName) {
  const cwdApp = path.join(path.resolve(process.cwd()), 'builder', appName);
  try {
    if (!nodeFs().existsSync(cwdApp)) {
      return null;
    }
    const st = nodeFs().statSync(cwdApp);
    if (!st || typeof st.isDirectory !== 'function' || !st.isDirectory()) {
      return null;
    }
    if (isSystemBuilderAppName(appName) && !isProjectBuilderAppDirectory(cwdApp)) {
      return null;
    }
    return cwdApp;
  } catch {
    return null;
  }
}

/**
 * Gets the builder folder path:
 * 1. Plan 141 Tier‑1: `cwd/builder/<app>` or `cwd/integration/<app>` when a resolvable application manifest exists.
 * 2. Else **`cwd/builder/<app>`** when that directory exists. For **platform** apps (`keycloak`,
 *    `miso-controller`, `dataplane`), an **empty** cwd stub is ignored so materialization under
 *    `(work|home)/builder` still wins.
 * 3. Else **`(aifabrix-work or aifabrix-home)/builder/<appName>`** — used by setup / `up-platform` /
 *    `up-miso` / `up-dataplane` for template materialization.
 *
 * @param {string} appName - Application name
 * @returns {string} Absolute path to builder directory
 */
function getBuilderPath(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  const { resolveApplicationManifestPathSync } = require('./manifest-location');
  const manifestHit = resolveApplicationManifestPathSync({
    targetKey: appName,
    mode: 'auto',
    cwd: process.cwd()
  });
  if (manifestHit && (manifestHit.tier === 'cwd-builder' || manifestHit.tier === 'cwd-integration')) {
    return manifestHit.absolutePath;
  }
  const cwdHit = tryCwdBuilderPathOrNull(appName);
  if (cwdHit) {
    return cwdHit;
  }
  return path.join(getAppsMaterializationParent(), 'builder', appName);
}

/**
 * Resolves the deployment JSON file path for an application
 * Uses consistent naming: <app-name>-deploy.json
 * Supports backward compatibility with aifabrix-deploy.json
 *
 * @param {string} appName - Application name
 * @param {string} [appType] - Application type ('external' or other)
 * @param {boolean} [preferNew] - If true, only return new naming (no backward compat)
 * @returns {string} Absolute path to deployment JSON file
 */
function getDeployJsonPath(appName, appType, preferNew = false) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const appPath = getAppPath(appName, appType);
  const newPath = path.join(appPath, `${appName}-deploy.json`);

  // If preferNew is true, always return new naming
  if (preferNew) {
    return newPath;
  }

  // Check if new naming exists, otherwise fall back to old naming for backward compatibility
  const oldPath = path.join(appPath, 'aifabrix-deploy.json');
  if (fs.existsSync(newPath)) {
    return newPath;
  }

  // Fall back to old naming for backward compatibility
  if (fs.existsSync(oldPath)) {
    return oldPath;
  }

  // If neither exists, return new naming (for generation)
  return newPath;
}
const { resolveApplicationConfigPath, resolveRbacPath } = require('./app-config-resolver');
const { loadConfigFile } = require('./config-format');
/**
 * Checks if app type is external from variables object
 * @param {Object} variables - Parsed application config object
 * @returns {boolean} True if app type is external
 */
function isExternalAppType(variables) {
  return variables && variables.app && variables.app.type === 'external';
}

/**
 * Checks integration folder for any valid application config
 * @param {string} appName - Application name
 * @returns {Object|null} App type info or null if no config found
 */
function checkIntegrationFolder(appName) {
  const integrationPath = getIntegrationPath(appName);
  let variables;
  try {
    const configPath = resolveApplicationConfigPath(integrationPath);
    variables = loadConfigFile(configPath);
  } catch {
    return null;
  }
  if (variables) {
    const isExternal = isExternalAppType(variables);
    return {
      isExternal,
      appPath: integrationPath,
      appType: isExternal ? 'external' : 'regular',
      baseDir: 'integration'
    };
  }
  return null;
}

/**
 * Checks builder folder for app type
 * @param {string} appName - Application name
 * @returns {Object|null} App type info or null if no config found
 */
function checkBuilderFolder(appName) {
  const builderPath = getBuilderPath(appName);
  if (!fs.existsSync(builderPath)) {
    return null;
  }
  let variables;
  try {
    const configPath = resolveApplicationConfigPath(builderPath);
    variables = loadConfigFile(configPath);
  } catch {
    return null;
  }
  if (variables) {
    const isExternal = isExternalAppType(variables);
    return {
      isExternal,
      appPath: builderPath,
      appType: isExternal ? 'external' : 'regular',
      baseDir: 'builder'
    };
  }
  return null;
}
/**
 * Detects if an app is external type by checking application config.
 * Resolution order: integration/ first, then builder/; if neither exists, throws.
 * No CLI flag overrides this order.
 *
 * @param {string} appName - Application name
 * @param {Object} [options] - Detection options (reserved; options.type is ignored)
 * @returns {Promise<{isExternal: boolean, appPath: string, appType: string, baseDir?: string}>}
 * @throws {Error} When app not found in integration/ or builder/
 */
async function detectAppType(appName, _options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  const integrationResult = checkIntegrationFolder(appName);
  if (integrationResult) return integrationResult;
  const builderResult = checkBuilderFolder(appName);
  if (builderResult) return builderResult;
  throw new Error(`App '${appName}' not found in integration/${appName} or builder/${appName}`);
}

/**
 * Resolve-specific app path: integration + env.template without application config → env-only mode.
 * If integration/<systemKey>/env.template exists but there is no application.yaml, application.json,
 * application.yml, or variables.yaml, use that directory with envOnly true (kv resolve only).
 * When any application config file exists in that folder, use full resolve (envOnly false).
 * Otherwise fall back to detectAppType (integration or builder with full config).
 *
 * @param {string} appName - Application name
 * @returns {Promise<{appPath: string, envOnly: boolean}>} appPath and envOnly (true when only env.template is used)
 * @throws {Error} When app not found in integration or builder
 */
async function getResolveAppPath(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  const integrationPath = getIntegrationPath(appName);
  const envTemplatePath = path.join(integrationPath, 'env.template');
  if (fs.existsSync(integrationPath) && fs.existsSync(envTemplatePath)) {
    try {
      resolveApplicationConfigPath(integrationPath);
      return { appPath: integrationPath, envOnly: false };
    } catch {
      return { appPath: integrationPath, envOnly: true };
    }
  }
  const { resolveApplicationManifestPathSync } = require('./manifest-location');
  const manifestHit = resolveApplicationManifestPathSync({
    targetKey: appName,
    mode: 'auto',
    cwd: process.cwd()
  });
  if (manifestHit) {
    return { appPath: manifestHit.absolutePath, envOnly: false };
  }
  const result = await detectAppType(appName);
  return { appPath: result.appPath, envOnly: false };
}

/**
 * @param {string} walkDir - Candidate workspace root (walk upward from cwd)
 * @param {string} cwd - Resolved process.cwd()
 * @param {ReturnType<typeof nodeFs>} disk
 * @returns {string|null}
 */
function tryIntegrationAppKeyAtWalkStep(walkDir, cwd, disk) {
  const integrationDir = path.join(walkDir, 'integration');
  try {
    if (!disk.existsSync(integrationDir)) {
      return null;
    }
    const intNorm = path.resolve(integrationDir);
    if (cwd !== intNorm && !cwd.startsWith(intNorm + path.sep)) {
      return null;
    }
    const rel = path.relative(intNorm, cwd);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      return null;
    }
    return rel.split(path.sep)[0] || null;
  } catch {
    return null;
  }
}

/**
 * Resolve app folder name when cwd is under some ancestor's `integration/<systemKey>/`.
 * Walks up from cwd (does not use {@link getIntegrationBuilderBaseDir}) so detection still works
 * when the canonical base is config/home but the shell is inside a checkout's integration tree.
 */
function resolveIntegrationAppKeyFromCwd() {
  const cwd = path.resolve(process.cwd());
  const disk = nodeFs();
  let p = cwd;
  for (let i = 0; i < 64; i += 1) {
    const key = tryIntegrationAppKeyAtWalkStep(p, cwd, disk);
    if (key) {
      return key;
    }
    const parent = path.dirname(p);
    if (parent === p) {
      break;
    }
    p = parent;
  }
  return null;
}

module.exports = {
  getAifabrixHome,
  getAifabrixWork,
  getConfigDirForPaths,
  getAifabrixSystemDir,
  getPrimaryUserSecretsLocalPath,
  getApplicationsBaseDir,
  getDevDirectory,
  getAppPath,
  getAppsMaterializationParent,
  getCwdIntegrationRoot,
  getCwdBuilderRoot,
  getProjectRoot,
  findProjectRootFromCwd,
  getIntegrationPath,
  getBuilderPath,
  getIntegrationRoot,
  getBuilderRoot,
  getIntegrationBuilderBaseDir,
  SYSTEM_BUILDER_APP_KEYS,
  isSystemBuilderAppName,
  getProjectBuilderAppPath,
  getSystemPlatformMaterializationParent,
  getSystemBuilderRoot,
  resolveSystemBuilderParentDir,
  listIntegrationAppNames,
  listBuilderAppNames,
  resolveBuildContext,
  getDeployJsonPath,
  resolveApplicationConfigPath,
  resolveRbacPath,
  detectAppType,
  getResolveAppPath,
  resolveIntegrationAppKeyFromCwd,
  clearProjectRootCache
};

