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
const os = require('os');
const yaml = require('js-yaml');

/**
 * Resolves secrets file path (backward compatibility)
 * Checks common locations if path is not provided
 * @function resolveSecretsPath
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @returns {string} Resolved secrets file path
 */
function resolveSecretsPath(secretsPath) {
  let resolvedPath = secretsPath;

  if (!resolvedPath) {
    // Check common locations for secrets.local.yaml
    const commonLocations = [
      path.join(process.cwd(), '..', 'aifabrix-setup', 'secrets.local.yaml'),
      path.join(process.cwd(), '..', '..', 'aifabrix-setup', 'secrets.local.yaml'),
      path.join(process.cwd(), 'secrets.local.yaml'),
      path.join(process.cwd(), '..', 'secrets.local.yaml'),
      path.join(os.homedir(), '.aifabrix', 'secrets.yaml')
    ];

    // Find first existing file
    for (const location of commonLocations) {
      if (fs.existsSync(location)) {
        resolvedPath = location;
        break;
      }
    }

    // If none found, use default location
    if (!resolvedPath) {
      resolvedPath = path.join(os.homedir(), '.aifabrix', 'secrets.yaml');
    }
  } else if (secretsPath.startsWith('..')) {
    resolvedPath = path.resolve(process.cwd(), secretsPath);
  }

  return resolvedPath;
}

/**
 * Determines the actual secrets file path that loadSecrets would use
 * Mirrors the cascading lookup logic from loadSecrets
 * @function getActualSecretsPath
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @param {string} [appName] - Application name (optional, for variables.yaml lookup)
 * @returns {string} Actual secrets file path that would be used
 */
function getActualSecretsPath(secretsPath, appName) {
  // If explicit path provided, use it (backward compatibility)
  if (secretsPath) {
    return resolveSecretsPath(secretsPath);
  }

  // Cascading lookup: user's file first
  const userSecretsPath = path.join(os.homedir(), '.aifabrix', 'secrets.local.yaml');
  if (fs.existsSync(userSecretsPath)) {
    return userSecretsPath;
  }

  // Then check build.secrets from variables.yaml if appName provided
  if (appName) {
    const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');
    if (fs.existsSync(variablesPath)) {
      try {
        const variablesContent = fs.readFileSync(variablesPath, 'utf8');
        const variables = yaml.load(variablesContent);

        if (variables?.build?.secrets) {
          const buildSecretsPath = path.resolve(
            path.dirname(variablesPath),
            variables.build.secrets
          );

          if (fs.existsSync(buildSecretsPath)) {
            return buildSecretsPath;
          }
        }
      } catch (error) {
        // Ignore errors, continue to next check
      }
    }
  }

  // If still no secrets found, try default location
  const defaultPath = path.join(os.homedir(), '.aifabrix', 'secrets.yaml');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  // Return user's file path as default (even if it doesn't exist) for error messages
  return userSecretsPath;
}

module.exports = {
  resolveSecretsPath,
  getActualSecretsPath
};

