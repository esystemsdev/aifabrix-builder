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
const config = require('../config');
const paths = require('./paths');

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
      path.join(paths.getAifabrixHome(), 'secrets.yaml')
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
      resolvedPath = path.join(paths.getAifabrixHome(), 'secrets.yaml');
    }
  } else if (secretsPath.startsWith('..')) {
    resolvedPath = path.resolve(process.cwd(), secretsPath);
  }

  return resolvedPath;
}

/**
 * Determines the actual secrets file paths that loadSecrets would use
 * Mirrors the cascading lookup logic from loadSecrets
 * Checks config.yaml for general secrets-path as fallback
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

  // Cascading lookup: user's file first
  const userSecretsPath = path.join(os.homedir(), '.aifabrix', 'secrets.local.yaml');

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

  // If no build.secrets found in variables.yaml, check config.yaml for general secrets-path
  if (!buildSecretsPath) {
    try {
      const generalSecretsPath = await config.getSecretsPath();
      if (generalSecretsPath) {
        // Resolve relative paths from current working directory
        buildSecretsPath = path.isAbsolute(generalSecretsPath)
          ? generalSecretsPath
          : path.resolve(process.cwd(), generalSecretsPath);
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

