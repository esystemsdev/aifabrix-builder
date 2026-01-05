/**
 * Path Utilities for AI Fabrix Builder
 *
 * Centralized helpers for resolving filesystem locations with support for
 * AIFABRIX_HOME override. Defaults to ~/.aifabrix when not specified.
 *
 * @fileoverview Path resolution utilities with environment overrides
 * @author AI Fabrix Team
 * @version 2.0.0
 */

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
 * Returns the base AI Fabrix directory.
 * Resolved from config.yaml `aifabrix-home` (stored under OS home).
 * Falls back to ~/.aifabrix when not specified.
 *
 * @returns {string} Absolute path to the AI Fabrix home directory
 */
function getAifabrixHome() {
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  if (!isTestEnv) {
    try {
      const configPath = path.join(safeHomedir(), '.aifabrix', 'config.yaml');
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
function findProjectRootFromJest() {
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
 * Gets the project root directory by finding package.json
 * Works reliably in all environments including Jest tests and CI
 * @returns {string} Absolute path to project root
 */
function getProjectRoot() {
  // Always check global.PROJECT_ROOT first (for test isolation)
  // Trust it if set - test setup already verified it exists
  if (typeof global !== 'undefined' && global.PROJECT_ROOT) {
    // Always use global.PROJECT_ROOT if set (don't cache, as it might change between tests)
    // Clear cache to ensure we don't use stale cached value
    cachedProjectRoot = null;
    return global.PROJECT_ROOT;
  }

  // Return cached value if available
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }

  // Try multiple strategies to find project root
  const foundRoot = findProjectRootByWalkingUp(__dirname) ||
    findProjectRootFromCwd() ||
    findProjectRootFromJest();

  if (foundRoot) {
    cachedProjectRoot = foundRoot;
    return cachedProjectRoot;
  }

  // Fallback strategy
  const fallbackRoot = getFallbackProjectRoot();
  cachedProjectRoot = fallbackRoot;
  return cachedProjectRoot;
}

/**
 * Returns the applications base directory for a developer.
 * Dev 0: <home>/applications
 * Dev > 0: <home>/applications-dev-{id}
 *
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
 * Returns the developer-specific application directory.
 * Dev 0: points to applications/ (root)
 * Dev > 0: <home>/applications-dev-{id} (root)
 *
 * @param {string} appName - Application name
 * @param {number|string} developerId - Developer ID
 * @returns {string} Absolute path to developer-specific app directory
 */
function getDevDirectory(appName, developerId) {
  const baseDir = getApplicationsBaseDir(developerId);
  // All files should be generated at the root of the applications folder
  // Dev 0: <home>/applications
  // Dev > 0: <home>/applications-dev-{id}
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
 * Gets the integration folder path for external systems
 * @param {string} appName - Application name
 * @returns {string} Absolute path to integration directory
 */
function getIntegrationPath(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  return path.join(process.cwd(), 'integration', appName);
}

/**
 * Gets the builder folder path for regular applications
 * @param {string} appName - Application name
 * @returns {string} Absolute path to builder directory
 */
function getBuilderPath(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }
  return path.join(process.cwd(), 'builder', appName);
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

/**
 * Reads and parses variables.yaml file
 * @param {string} variablesPath - Path to variables.yaml file
 * @returns {Object|null} Parsed variables object or null if error
 */
function readVariablesFile(variablesPath) {
  try {
    if (!fs.existsSync(variablesPath)) {
      return null;
    }
    const content = fs.readFileSync(variablesPath, 'utf8');
    return yaml.load(content);
  } catch {
    return null;
  }
}

/**
 * Checks if app type is external from variables object
 * @param {Object} variables - Parsed variables.yaml object
 * @returns {boolean} True if app type is external
 */
function isExternalAppType(variables) {
  return variables && variables.app && variables.app.type === 'external';
}

/**
 * Checks integration folder for external app type
 * @param {string} appName - Application name
 * @returns {Object|null} App type info or null if not found
 */
function checkIntegrationFolder(appName) {
  const integrationPath = getIntegrationPath(appName);
  const variablesPath = path.join(integrationPath, 'variables.yaml');
  const variables = readVariablesFile(variablesPath);

  if (variables && isExternalAppType(variables)) {
    return {
      isExternal: true,
      appPath: integrationPath,
      appType: 'external',
      baseDir: 'integration'
    };
  }
  return null;
}

/**
 * Checks builder folder for app type
 * @param {string} appName - Application name
 * @returns {Object} App type info
 */
function checkBuilderFolder(appName) {
  const builderPath = getBuilderPath(appName);
  const variablesPath = path.join(builderPath, 'variables.yaml');
  const variables = readVariablesFile(variablesPath);

  if (variables) {
    const isExternal = isExternalAppType(variables);
    return {
      isExternal,
      appPath: builderPath,
      appType: isExternal ? 'external' : 'regular',
      baseDir: 'builder'
    };
  }

  // Default to regular app in builder folder
  return {
    isExternal: false,
    appPath: builderPath,
    appType: 'regular',
    baseDir: 'builder'
  };
}

/**
 * Detects if an app is external type by checking variables.yaml
 * Checks both integration/ and builder/ folders for backward compatibility
 *
 * @param {string} appName - Application name
 * @returns {Promise<{isExternal: boolean, appPath: string, appType: string}>}
 */
async function detectAppType(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  // Check integration folder first (new structure)
  const integrationResult = checkIntegrationFolder(appName);
  if (integrationResult) {
    return integrationResult;
  }

  // Check builder folder (backward compatibility)
  return checkBuilderFolder(appName);
}

module.exports = {
  getAifabrixHome,
  getApplicationsBaseDir,
  getDevDirectory,
  getAppPath,
  getProjectRoot,
  getIntegrationPath,
  getBuilderPath,
  getDeployJsonPath,
  detectAppType
};

