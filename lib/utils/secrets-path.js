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

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../config');
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
 * @param {string} [appName] - Application name (optional, for variables.yaml lookup)
 * @returns {Promise<Object>} Object with userPath and buildPath (if configured)
 * @returns {string} returns.userPath - User's secrets file path (~/.aifabrix/secrets.local.yaml)
 * @returns {string|null} returns.buildPath - App's build.secrets file path (if configured in variables.yaml or config.yaml)
 */
async function getActualSecretsPath(secretsPath, appName) {
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

  // Check build.secrets from variables.yaml if appName provided
  let buildSecretsPath = null;
  if (appName) {
    const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
    if (fs.existsSync(variablesPath)) {
      try {
        const variablesContent = fs.readFileSync(variablesPath, 'utf8');
        const variables = yaml.load(variablesContent);

        if (variables?.build?.secrets) {
          buildSecretsPath = path.resolve(
            path.dirname(variablesPath),
            variables.build.secrets
          );
        }
      } catch (error) {
        // Ignore errors, continue
      }
    }
  }

  // If no build.secrets found in variables.yaml, check config.yaml for canonical secrets path
  if (!buildSecretsPath) {
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

