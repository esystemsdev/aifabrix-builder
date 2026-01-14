/**
 * AI Fabrix Builder Secrets Path Resolution
 *
 * This module handles secrets file path resolution with cascading lookup support.
 * Determines the actual path that would be used for loading secrets.
 *
 * @fileoverview Secrets path resolution utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const config = require('../core/config');
const paths = require('./paths');

/**
 * Resolves secrets file path when an explicit path is provided.
 * If not provided, returns default fallback under <home>/secrets.yaml.
 * @function resolveSecretsPath
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @returns {string} Resolved secrets file path
 */
function resolveSecretsPath(secretsPath) {
  if (secretsPath && secretsPath.startsWith('..')) {
    return path.resolve(process.cwd(), secretsPath);
  }
  if (secretsPath) {
    return secretsPath;
  }
  // Default fallback
  return path.join(paths.getAifabrixHome(), 'secrets.yaml');
}

/**
 * Determines the actual secrets file paths that loadSecrets would use
 * Mirrors the cascading lookup logic from loadSecrets
 * Uses config.yaml for default secrets path as fallback
 *
 * @async
 * @function getActualSecretsPath
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @param {string} [_appName] - Application name (optional, for backward compatibility, unused)
 * @returns {Promise<Object>} Object with userPath and buildPath (if configured)
 * @returns {string} returns.userPath - User's secrets file path (~/.aifabrix/secrets.local.yaml)
 * @returns {string|null} returns.buildPath - App's secrets file path (if configured in config.yaml)
 */
async function getActualSecretsPath(secretsPath, _appName) {
  // If explicit path provided, use it (backward compatibility)
  if (secretsPath) {
    const resolvedPath = resolveSecretsPath(secretsPath);
    return {
      userPath: resolvedPath,
      buildPath: null
    };
  }

  // Cascading lookup: user's file first (under configured home)
  const userSecretsPath = path.join(paths.getAifabrixHome(), 'secrets.local.yaml');

  // Check config.yaml for canonical secrets path
  let buildSecretsPath = null;
  try {
    const canonicalSecretsPath = await config.getAifabrixSecretsPath();
    if (canonicalSecretsPath) {
      buildSecretsPath = path.isAbsolute(canonicalSecretsPath)
        ? canonicalSecretsPath
        : path.resolve(process.cwd(), canonicalSecretsPath);
    }
  } catch (error) {
    // Ignore errors, continue
  }

  // Return both paths (even if files don't exist) for error messages
  return {
    userPath: userSecretsPath,
    buildPath: buildSecretsPath
  };
}

module.exports = {
  resolveSecretsPath,
  getActualSecretsPath
};

