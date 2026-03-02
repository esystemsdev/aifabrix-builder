/**
 * env.template authentication kv:// validation helpers
 *
 * Collects required kv paths from system configs and extracts kv paths from env.template
 * for validating that external integrations have all authentication secrets in env.template.
 *
 * @fileoverview Auth kv validation for env.template
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { loadExternalIntegrationConfig, loadSystemFile } = require('../generator/external');

/**
 * Extracts all kv:// paths from env.template content (RHS of VAR=value lines).
 * Uses same regex as validateKvReferencesInLines.
 *
 * @function extractKvPathsFromEnvTemplate
 * @param {string} content - env.template file content
 * @returns {Set<string>} Set of kv:// paths found (e.g. kv://hubspot/client-id)
 *
 * @example
 * const paths = extractKvPathsFromEnvTemplate('CLIENT_ID=kv://hubspot/client-id\nPORT=3000');
 * // paths has 'kv://hubspot/client-id'
 */
function extractKvPathsFromEnvTemplate(content) {
  const paths = new Set();
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!trimmed.includes('=')) continue;
    const [_key, value] = trimmed.split('=', 2);
    const val = (value || '').trim();
    const matches = val.match(/kv:\/\/[^\s]*/g) || [];
    for (const fullRef of matches) {
      paths.add(fullRef);
    }
  }
  return paths;
}

/**
 * Collects required kv:// paths from authentication.security of all system configs.
 * For external integrations only. On config load failure, returns empty set and optional warning.
 *
 * @async
 * @function collectRequiredAuthKvPaths
 * @param {string} appPath - Application directory path
 * @param {Object} [options] - Options (reserved)
 * @returns {Promise<{ requiredPaths: Set<string>, warning?: string }>} Required kv paths and optional warning
 *
 * @example
 * const { requiredPaths } = await collectRequiredAuthKvPaths('/path/to/integration/hubspot');
 * // requiredPaths has kv:// paths from authentication.security
 */
async function collectRequiredAuthKvPaths(appPath, _options = {}) {
  const requiredPaths = new Set();
  try {
    const { schemaBasePath, systemFiles } = await loadExternalIntegrationConfig(appPath);
    for (const systemFileName of systemFiles) {
      const systemJson = await loadSystemFile(appPath, schemaBasePath, systemFileName);
      const security = systemJson.authentication?.security;
      if (!security || typeof security !== 'object') continue;
      for (const val of Object.values(security)) {
        if (typeof val === 'string' && /^kv:\/\/.+/.test(val)) {
          requiredPaths.add(val);
        }
      }
    }
    return { requiredPaths };
  } catch (error) {
    return {
      requiredPaths: new Set(),
      warning: `Could not validate auth kv coverage (skip auth check): ${error.message}`
    };
  }
}

/**
 * Validates that env.template covers all authentication.security kv paths for external apps.
 * Modifies errors and warnings in place.
 *
 * @async
 * @function validateAuthKvCoverage
 * @param {string} appPath - Application path
 * @param {string} content - env.template content
 * @param {string[]} errors - Errors array to push to
 * @param {string[]} warnings - Warnings array to push to
 * @param {Object} [options] - Options
 */
async function validateAuthKvCoverage(appPath, content, errors, warnings, options = {}) {
  const authResult = await collectRequiredAuthKvPaths(appPath, options);
  if (authResult.warning) warnings.push(authResult.warning);
  if (authResult.requiredPaths.size === 0) return;
  const actualPaths = extractKvPathsFromEnvTemplate(content);
  for (const requiredPath of authResult.requiredPaths) {
    if (!actualPaths.has(requiredPath)) {
      errors.push(
        `env.template: Missing required authentication secret (required by authentication.security): add a variable with value ${requiredPath}`
      );
    }
  }
}

module.exports = {
  extractKvPathsFromEnvTemplate,
  collectRequiredAuthKvPaths,
  validateAuthKvCoverage
};
