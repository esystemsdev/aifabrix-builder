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
 * Gets the project root directory by finding package.json
 * Works reliably in all environments including Jest tests and CI
 * @returns {string} Absolute path to project root
 */
function getProjectRoot() {
  // Return cached value if available
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }

  // Try multiple strategies to find project root
  const searchPaths = [];

  // Strategy 1: Walk up from __dirname (lib/utils/) to find package.json
  let currentDir = __dirname;
  for (let i = 0; i < 10; i++) {
    searchPaths.push(currentDir);
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      cachedProjectRoot = currentDir;
      return cachedProjectRoot;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  // Strategy 2: Try from process.cwd() (works if tests don't change cwd)
  try {
    const cwd = process.cwd();
    if (cwd && cwd !== '/') {
      searchPaths.push(cwd);
      const cwdPackageJson = path.join(cwd, 'package.json');
      if (fs.existsSync(cwdPackageJson)) {
        cachedProjectRoot = cwd;
        return cachedProjectRoot;
      }
    }
  } catch {
    // Ignore errors
  }

  // Strategy 3: Check if Jest rootDir is available (in test environments)
  if (typeof jest !== 'undefined' && jest.config && jest.config.rootDir) {
    const jestRoot = jest.config.rootDir;
    const jestPackageJson = path.join(jestRoot, 'package.json');
    if (fs.existsSync(jestPackageJson)) {
      cachedProjectRoot = jestRoot;
      return cachedProjectRoot;
    }
  }

  // Strategy 4: Fallback to __dirname relative path (lib/utils -> project root)
  // This should work in most cases
  const fallbackRoot = path.resolve(__dirname, '..', '..');

  // Verify fallback actually has package.json
  const fallbackPackageJson = path.join(fallbackRoot, 'package.json');
  if (fs.existsSync(fallbackPackageJson)) {
    cachedProjectRoot = fallbackRoot;
    return cachedProjectRoot;
  }

  // Last resort: return fallback even if package.json not found
  // (might happen in some edge cases, but better than crashing)
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
  const integrationPath = getIntegrationPath(appName);
  const integrationVariablesPath = path.join(integrationPath, 'variables.yaml');

  if (fs.existsSync(integrationVariablesPath)) {
    try {
      const content = fs.readFileSync(integrationVariablesPath, 'utf8');
      const variables = yaml.load(content);
      if (variables.app && variables.app.type === 'external') {
        return {
          isExternal: true,
          appPath: integrationPath,
          appType: 'external',
          baseDir: 'integration'
        };
      }
    } catch {
      // Ignore errors, continue to check builder folder
    }
  }

  // Check builder folder (backward compatibility)
  const builderPath = getBuilderPath(appName);
  const builderVariablesPath = path.join(builderPath, 'variables.yaml');

  if (fs.existsSync(builderVariablesPath)) {
    try {
      const content = fs.readFileSync(builderVariablesPath, 'utf8');
      const variables = yaml.load(content);
      const isExternal = variables.app && variables.app.type === 'external';
      return {
        isExternal,
        appPath: builderPath,
        appType: isExternal ? 'external' : 'regular',
        baseDir: 'builder'
      };
    } catch {
      // If we can't read it, assume regular app in builder folder
      return {
        isExternal: false,
        appPath: builderPath,
        appType: 'regular',
        baseDir: 'builder'
      };
    }
  }

  // Default to builder folder if neither exists
  return {
    isExternal: false,
    appPath: builderPath,
    appType: 'regular',
    baseDir: 'builder'
  };
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

