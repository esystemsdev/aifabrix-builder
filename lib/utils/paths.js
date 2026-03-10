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
 * Returns the path to the config directory (same precedence as config.js so both read the same config).
 * Priority: AIFABRIX_CONFIG (dirname) → AIFABRIX_HOME → ~/.aifabrix.
 * @returns {string} Absolute path to config directory
 */
function getConfigDirForPaths() {
  const configFile = process.env.AIFABRIX_CONFIG && typeof process.env.AIFABRIX_CONFIG === 'string';
  if (configFile) {
    return path.dirname(path.resolve(process.env.AIFABRIX_CONFIG.trim()));
  }
  if (process.env.AIFABRIX_HOME && typeof process.env.AIFABRIX_HOME === 'string') {
    return path.resolve(process.env.AIFABRIX_HOME.trim());
  }
  return path.join(safeHomedir(), '.aifabrix');
}

/**
 * Returns the base AI Fabrix directory.
 * Priority: AIFABRIX_HOME env → config.yaml `aifabrix-home` (from AIFABRIX_HOME or ~/.aifabrix) → ~/.aifabrix.
 *
 * @returns {string} Absolute path to the AI Fabrix home directory
 */
function getAifabrixHome() {
  if (process.env.AIFABRIX_HOME && typeof process.env.AIFABRIX_HOME === 'string') {
    return path.resolve(process.env.AIFABRIX_HOME.trim());
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
          return path.resolve(homeOverride);
        }
      }
    } catch {
      // Ignore errors and fall back to default
    }
  }
  return path.join(safeHomedir(), '.aifabrix');
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
  return fs.existsSync(packageJsonPath);
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
  // Return cached value if available and valid
  if (cachedProjectRoot && hasPackageJson(cachedProjectRoot)) {
    return cachedProjectRoot;
  }

  return tryFindProjectRoot();
}

/**
 * Returns the applications base directory. Dev 0: <home>/applications; Dev > 0: <home>/applications-dev-{id}
 * @param {number|string} developerId - Developer ID
 * @returns {string} Absolute path to applications base directory
 */
function getApplicationsBaseDir(developerId) {
  const idNum = typeof developerId === 'string' ? parseInt(developerId, 10) : developerId;
  const base = getAifabrixHome();
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
 * Gets the application path (builder or integration folder)
 * @param {string} appName - Application name
 * @param {string} [appType] - Application type ('external' or other)
 * @returns {string} Absolute path to application directory
 */
function getAppPath(appName, appType) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const baseDir = appType === 'external' ? 'integration' : 'builder';
  return path.join(process.cwd(), baseDir, appName);
}

/**
 * Base directory for integration/builder: project root when cwd is inside project, else cwd.
 * @returns {string} Directory to resolve integration/ and builder/ from
 */
function getIntegrationBuilderBaseDir() {
  const root = getProjectRoot();
  const cwd = path.resolve(process.cwd());
  const rootNorm = path.resolve(root);
  if (cwd === rootNorm || cwd.startsWith(rootNorm + path.sep)) {
    return rootNorm;
  }
  return cwd;
}

/**
 * Returns the integration root directory (used for listing apps).
 * @returns {string} Absolute path to integration/ directory
 */
function getIntegrationRoot() {
  return path.join(getIntegrationBuilderBaseDir(), 'integration');
}

/**
 * Returns the builder root directory. Uses AIFABRIX_BUILDER_DIR when set, else project/cwd + builder.
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
 * Lists app names (directories) under integration root. Excludes dot-prefixed entries.
 * Returns [] if root does not exist.
 * @returns {string[]} Sorted list of app directory names
 */
function listIntegrationAppNames() {
  const root = getIntegrationRoot();
  if (!fs.existsSync(root)) {
    return [];
  }
  const stat = fs.statSync(root);
  if (!stat || typeof stat.isDirectory !== 'function' || !stat.isDirectory()) {
    return [];
  }
  const entries = fs.readdirSync(root);
  return entries
    .filter(name => !name.startsWith('.'))
    .filter(name => {
      const fullPath = path.join(root, name);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort();
}

/**
 * Lists app names (directories) under builder root. Excludes dot-prefixed entries.
 * Returns [] if root does not exist.
 * @returns {string[]} Sorted list of app directory names
 */
function listBuilderAppNames() {
  const root = getBuilderRoot();
  if (!fs.existsSync(root)) {
    return [];
  }
  const stat = fs.statSync(root);
  if (!stat || typeof stat.isDirectory !== 'function' || !stat.isDirectory()) {
    return [];
  }
  const entries = fs.readdirSync(root);
  return entries
    .filter(name => !name.startsWith('.'))
    .filter(name => {
      const fullPath = path.join(root, name);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort();
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
 * @param {string} appName - Application name
 * @returns {string} Absolute path to builder directory
 */
function getBuilderPath(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  const builderRoot = process.env.AIFABRIX_BUILDER_DIR && typeof process.env.AIFABRIX_BUILDER_DIR === 'string'
    ? process.env.AIFABRIX_BUILDER_DIR.trim()
    : null;
  if (builderRoot) {
    return path.join(builderRoot, appName);
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
const { resolveApplicationConfigPath } = require('./app-config-resolver');
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
 * Resolve-specific app path: prefer integration + env.template only (env-only mode).
 * If integration/<appName>/env.template exists, use that directory without requiring application.yaml.
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
    return { appPath: integrationPath, envOnly: true };
  }
  const result = await detectAppType(appName);
  return { appPath: result.appPath, envOnly: false };
}

/** Resolve appKey when cwd is inside integration/<appKey>/. */
function resolveIntegrationAppKeyFromCwd() {
  const integrationNorm = path.resolve(path.join(getIntegrationBuilderBaseDir(), 'integration'));
  const cwd = path.resolve(process.cwd());
  if (cwd !== integrationNorm && !cwd.startsWith(integrationNorm + path.sep)) return null;
  return path.relative(integrationNorm, cwd).split(path.sep)[0] || null;
}

module.exports = {
  getAifabrixHome,
  getConfigDirForPaths,
  getApplicationsBaseDir,
  getDevDirectory,
  getAppPath,
  getProjectRoot,
  getIntegrationPath,
  getBuilderPath,
  getIntegrationRoot,
  getBuilderRoot,
  listIntegrationAppNames,
  listBuilderAppNames,
  resolveBuildContext,
  getDeployJsonPath,
  resolveApplicationConfigPath,
  detectAppType,
  getResolveAppPath,
  resolveIntegrationAppKeyFromCwd,
  clearProjectRootCache
};

