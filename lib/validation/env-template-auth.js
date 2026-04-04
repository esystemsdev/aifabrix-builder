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
const { getKvPathSegmentForSecurityKey } = require('../utils/credential-secrets-env');

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
 * Extracts kv:// paths from commented lines in env.template (e.g. # KEY=kv://path or # kv://path).
 * Used to treat commented-out keys as intentionally disabled for auth-coverage validation.
 * Scans the whole line after '#' so both key=value and bare/commented refs are recognized.
 *
 * @function extractKvPathsFromCommentedLines
 * @param {string} content - env.template file content
 * @returns {Set<string>} Set of kv:// paths found in commented lines (e.g. kv://avoma/apikey)
 */
function extractKvPathsFromCommentedLines(content) {
  const paths = new Set();
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) continue;
    const afterHash = trimmed.slice(1).trim();
    const matches = afterHash.match(/kv:\/\/[^\s]*/g) || [];
    for (const fullRef of matches) {
      paths.add(fullRef);
    }
  }
  return paths;
}

/**
 * Returns true if the required path is present in the set or matches any entry case-insensitively.
 * Used so commented-out keys match required paths regardless of kv path casing (e.g. apiKey vs apikey).
 *
 * @function setHasPathIgnoreCase
 * @param {Set<string>} pathSet - Set of kv paths (e.g. from commented lines)
 * @param {string} requiredPath - Required path from authentication.security
 * @returns {boolean} True if requiredPath is in pathSet or matches any element when lowercased
 */
function setHasPathIgnoreCase(pathSet, requiredPath) {
  if (pathSet.has(requiredPath)) return true;
  const requiredLower = requiredPath.toLowerCase();
  for (const p of pathSet) {
    if (p.toLowerCase() === requiredLower) return true;
  }
  return false;
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
 * const { requiredPaths } = await collectRequiredAuthKvPaths('/path/to/integration/hubspot-test');
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
  const commentedPaths = extractKvPathsFromCommentedLines(content);
  for (const requiredPath of authResult.requiredPaths) {
    const inActive = actualPaths.has(requiredPath);
    const inCommented = setHasPathIgnoreCase(commentedPaths, requiredPath);
    if (!inActive && !inCommented) {
      errors.push(
        `env.template: Missing required authentication secret (required by authentication.security): add a variable with value ${requiredPath}`
      );
    }
  }
}

/**
 * Derives system key from system file name (e.g. hubspot-system.yaml -> hubspot).
 * @param {string} systemFileName - System file name
 * @returns {string}
 */
function systemKeyFromFileName(systemFileName) {
  if (!systemFileName || typeof systemFileName !== 'string') return '';
  return systemFileName.replace(/-system\.(yaml|yml|json)$/i, '');
}

/**
 * Validates that authentication.security paths in system files match the canonical path
 * (kv://<systemKey>/<getKvPathSegmentForSecurityKey(securityKey)>). Pushes errors when they differ.
 *
 * @async
 * @function validateAuthSecurityPathConsistency
 * @param {string} appPath - Application path (integration or builder dir)
 * @param {string[]} errors - Errors array to push to
 * @param {string[]} warnings - Warnings array to push to (unused; for API consistency)
 */
async function validateAuthSecurityPathConsistency(appPath, errors, _warnings) {
  try {
    const { schemaBasePath, systemFiles } = await loadExternalIntegrationConfig(appPath);
    for (const systemFileName of systemFiles) {
      const systemKey = systemKeyFromFileName(systemFileName);
      if (!systemKey) continue;
      const systemJson = await loadSystemFile(appPath, schemaBasePath, systemFileName);
      const security = systemJson.authentication?.security;
      if (!security || typeof security !== 'object') continue;
      for (const [key, value] of Object.entries(security)) {
        if (typeof value !== 'string' || !/^kv:\/\/.+/.test(value)) continue;
        const canonicalSegment = getKvPathSegmentForSecurityKey(key);
        const canonicalPath = canonicalSegment ? `kv://${systemKey}/${canonicalSegment}` : null;
        if (canonicalPath && value !== canonicalPath) {
          errors.push(
            `authentication.security.${key} has path ${value}; canonical path is ${canonicalPath}. Run \`aifabrix repair <systemKey>\` to normalize.`
          );
        }
      }
    }
  } catch (error) {
    _warnings.push(`Could not validate auth path consistency: ${error.message}`);
  }
}

module.exports = {
  extractKvPathsFromEnvTemplate,
  extractKvPathsFromCommentedLines,
  setHasPathIgnoreCase,
  collectRequiredAuthKvPaths,
  validateAuthKvCoverage,
  validateAuthSecurityPathConsistency,
  systemKeyFromFileName
};
