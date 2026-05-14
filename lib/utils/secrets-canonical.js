/**
 * Canonical secrets path and YAML helpers
 *
 * @fileoverview Read/merge canonical secrets from config path
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../core/config');

/**
 * Read a YAML file and return parsed object
 * @function readYamlAtPath
 * @param {string} filePath - Absolute file path
 * @returns {Object} Parsed YAML object
 */
function readYamlAtPath(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
}

/**
 * Merge a single secret value from canonical into result
 * @function mergeSecretValue
 * @param {Object} result - Result object to merge into
 * @param {string} key - Secret key
 * @param {*} canonicalValue - Value from canonical secrets
 */
function mergeSecretValue(result, key, canonicalValue, keySources, canonicalSourcePath) {
  const currentValue = result[key];
  // Fill missing, empty, or undefined values
  if (!(key in result) || currentValue === undefined || currentValue === null || currentValue === '') {
    result[key] = canonicalValue;
    if (keySources && canonicalSourcePath) {
      keySources[key] = canonicalSourcePath;
    }
    return;
  }
  // Only replace values that are encrypted (have secure:// prefix)
  // Plaintext values (no secure://) are used as-is
  if (typeof currentValue === 'string' && typeof canonicalValue === 'string') {
    if (currentValue.startsWith('secure://')) {
      result[key] = canonicalValue;
      if (keySources && canonicalSourcePath) {
        keySources[key] = canonicalSourcePath;
      }
    }
  }
}

/**
 * Apply canonical secrets path override if configured and file exists
 * @async
 * @function applyCanonicalSecretsOverride
 * @param {Object} currentSecrets - Current secrets map
 * @param {Record<string, string>} [keySources] - Mutated: per-key source path when a value is taken from canonical YAML
 * @returns {Promise<Object>} Possibly overridden secrets
 */
async function applyCanonicalSecretsOverride(currentSecrets, keySources) {
  let mergedSecrets = currentSecrets || {};
  try {
    const canonicalPath = await config.getSecretsPath();
    if (!canonicalPath) {
      return mergedSecrets;
    }
    const resolvedCanonical = path.isAbsolute(canonicalPath)
      ? canonicalPath
      : path.resolve(process.cwd(), canonicalPath);
    if (!fs.existsSync(resolvedCanonical)) {
      return mergedSecrets;
    }
    const configSecrets = readYamlAtPath(resolvedCanonical);
    if (!configSecrets || typeof configSecrets !== 'object') {
      return mergedSecrets;
    }
    // Apply canonical secrets as a fallback source:
    // - Do NOT override any existing keys from user/build
    // - Add only missing keys from canonical path
    // - Also fill in empty/undefined values from canonical path
    // - Replace encrypted values (secure://) with canonical plaintext
    const result = { ...mergedSecrets };
    for (const [key, canonicalValue] of Object.entries(configSecrets)) {
      mergeSecretValue(result, key, canonicalValue, keySources, resolvedCanonical);
    }
    mergedSecrets = result;
  } catch {
    // ignore and fall through
  }
  return mergedSecrets;
}

module.exports = {
  readYamlAtPath,
  applyCanonicalSecretsOverride
};
