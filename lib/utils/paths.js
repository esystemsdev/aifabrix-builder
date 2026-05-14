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
 * Matches getBuilderPath / getIntegrationPath: respects AIFABRIX_BUILDER_DIR and
 * {@link getIntegrationBuilderBaseDir} (project, work tree, or config/home stable base — not raw cwd).
 * @param {string} appName - Application name
 * @param {string} [appType] - Application type ('external' or other)
 * @returns {string} Absolute path to application directory
 */
function getAppPath(appName, appType) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  if (appType === 'external') {
    return getIntegrationPath(appName);
  }
  return getBuilderPath(appName);
}

/**
 * Stable tree root for integration/builder when cwd is not inside the resolved project root:
 * same parent used for system `builder/<platform-app>` (config dir vs `aifabrix-home` / `AIFABRIX_HOME`).
 * Avoids anchoring paths to arbitrary `process.cwd()` (“traveling” across folders).
 *
 * @returns {string} Absolute directory whose `integration/` and `builder/` subdirs are defaults
 */
function getStableIntegrationBuilderFallbackBaseDir() {
  return resolveSystemBuilderParentDir(getAifabrixSystemDir(), getAifabrixHome());
}

/**
 * Base directory for integration/builder:
 * - **When `process.cwd()` is inside {@link getProjectRoot()}**, always that project root (so nested
 *   repos like `aifabrix-dataplane/` keep `integration/<app>` even if `AIFABRIX_WORK` points at a parent
 *   that only has `builder/` — avoids missing `application.json` / `application.yaml` under the wrong tree).
 * - Else `aifabrix-work` / `AIFABRIX_WORK` when that path contains `integration/` or `builder/`.
 * - Else {@link getStableIntegrationBuilderFallbackBaseDir} (config + `aifabrix-home` rules — never raw cwd alone).
 *
 * @returns {string} Directory to resolve integration/ and builder/ from
 */
function getIntegrationBuilderBaseDir() {
  const root = getProjectRoot();
  const cwd = path.resolve(process.cwd());
  const rootNorm = path.resolve(root);
  if (cwd === rootNorm || cwd.startsWith(rootNorm + path.sep)) {
    return rootNorm;
  }
  const work = getAifabrixWork();
  if (work) {
    const workNorm = path.resolve(work);
    const integrationUnderWork = path.join(workNorm, 'integration');
    const builderUnderWork = path.join(workNorm, 'builder');
    try {
      if (nodeFs().existsSync(integrationUnderWork) || nodeFs().existsSync(builderUnderWork)) {
        return workNorm;
      }
    } catch {
      // ignore fs errors
    }
  }
  return getStableIntegrationBuilderFallbackBaseDir();
}

/**
 * Returns the integration root directory (used for listing apps).
 * @returns {string} Absolute path to integration/ directory
 */
function getIntegrationRoot() {
  return path.join(getIntegrationBuilderBaseDir(), 'integration');
}

/**
 * Returns the builder root directory. Uses AIFABRIX_BUILDER_DIR when set, else
 * {@link getIntegrationBuilderBaseDir} + `/builder`.
 * @returns {string} Absolute path to builder/ directory
 */
function getBuilderRoot() {
  const envDir = process.env.AIFABRIX_BUILDER_DIR && typeof process.env.AIFABRIX_BUILDER_DIR === 'string'
    ? process.env.AIFABRIX_BUILDER_DIR.trim()
    : null;
  if (envDir) {
    return path.resolve(envDir);
  }
  return path.join(getIntegrationBuilderBaseDir(), 'builder');
}

/**
 * Platform system apps: project `builder/<app>` when present; else `builder/<app>` under
 * {@link getSystemBuilderRoot} (plan 141 Tier 2: `aifabrix-work` when set, else `aifabrix-home`).
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
 * Project/cwd `builder/<appName>` (no existence check).
 * @param {string} appName
 * @returns {string}
 */
function getProjectBuilderAppPath(appName) {
  return path.join(getIntegrationBuilderBaseDir(), 'builder', appName);
}

/**
 * Parent directory for platform system apps (`keycloak`, `miso-controller`, `dataplane`):
 * {@link getAifabrixWork} when set, else {@link getAifabrixHome} (plan 141 Tier 2).
 *
 * @returns {string} Absolute path (no trailing `builder/`)
 */
function getSystemPlatformMaterializationParent() {
  const work = getAifabrixWork();
  if (work) {
    return path.resolve(work);
  }
  return path.resolve(getAifabrixHome());
}

/**
 * Directory containing default materialization for platform apps: `<parent>/builder/<app>`.
 * Parent is {@link getSystemPlatformMaterializationParent} (`aifabrix-work` / `AIFABRIX_WORK` when set,
 * otherwise `aifabrix-home` / `AIFABRIX_HOME` / default `~/.aifabrix`).
 *
 * @returns {string}
 */
function getSystemBuilderRoot() {
  return path.join(getSystemPlatformMaterializationParent(), 'builder');
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
  const root = getIntegrationRoot();
  if (!disk.existsSync(root)) {
    return [];
  }
  let rootStat;
  try {
    rootStat = disk.statSync(root);
  } catch {
    return [];
  }
  if (!rootStat || typeof rootStat.isDirectory !== 'function' || !rootStat.isDirectory()) {
    return [];
  }
  const entries = disk.readdirSync(root);
  return entries.filter((name) => isAppSubdirSync(root, name)).sort();
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
 * Lists app names (directories) under builder root. Excludes dot-prefixed entries.
 * Merges project `builder/` with system builder root (platform keys only under the latter).
 * @returns {string[]} Sorted list of app directory names
 */
function listBuilderAppNames() {
  const disk = nodeFs();
  const names = new Set();
  const projectBuilder = path.join(getIntegrationBuilderBaseDir(), 'builder');
  addBuilderSubdirNamesToSet(disk, projectBuilder, names, null);
  addBuilderSubdirNamesToSet(disk, getSystemBuilderRoot(), names, isSystemBuilderAppName);
  return [...names].sort();
}

/**
 * Gets the integration folder path for external systems.
 * @param {string} appName - Application name
 * @returns {string} Absolute path to integration directory
 */
function getIntegrationPath(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  const base = getIntegrationBuilderBaseDir();
  return path.join(base, 'integration', appName);
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
 * Gets the builder folder path. Uses AIFABRIX_BUILDER_DIR when set, else project root.
 * Plan 141: when `cwd/builder/<app>` or `cwd/integration/<app>` contains a valid application
 * manifest, that path wins over `AIFABRIX_BUILDER_DIR` (Tier 1 before env override).
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
  const envBuilderRoot = process.env.AIFABRIX_BUILDER_DIR && typeof process.env.AIFABRIX_BUILDER_DIR === 'string'
    ? process.env.AIFABRIX_BUILDER_DIR.trim()
    : null;
  if (envBuilderRoot) {
    return path.join(path.resolve(envBuilderRoot), appName);
  }
  if (isSystemBuilderAppName(appName)) {
    const projectAppPath = getProjectBuilderAppPath(appName);
    if (isProjectBuilderAppDirectory(projectAppPath)) {
      return projectAppPath;
    }
    return path.join(getSystemBuilderRoot(), appName);
  }
  const base = getIntegrationBuilderBaseDir();
  return path.join(base, 'builder', appName);
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
  getProjectRoot,
  findProjectRootFromCwd,
  getIntegrationPath,
  getBuilderPath,
  getIntegrationRoot,
  getBuilderRoot,
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

