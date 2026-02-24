/**
 * AI Fabrix Builder – Secrets file validation
 *
 * Validates secrets.local.yaml (or given path): valid YAML, flat key-value structure,
 * and optional naming convention (*KeyVault suffix per keyvault.md).
 *
 * @fileoverview Secrets file validation for structure and naming
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Optional naming convention: keys should end with KeyVault or match known patterns.
 * @param {string} key - Secret key
 * @returns {boolean} True if key matches convention
 */
function keyMatchesNamingConvention(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.endsWith('KeyVault')) return true;
  return /^[a-z0-9-_]+KeyVault$/i.test(key);
}

/**
 * Validate that parsed secrets is a flat object (no nested objects for values).
 * @param {*} parsed - Parsed YAML
 * @param {boolean} checkNaming - Whether to check key naming
 * @returns {string[]} Errors
 */
function validateParsedSecrets(parsed, checkNaming) {
  const errors = [];
  if (parsed === null || parsed === undefined) return errors;
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push('Secrets file must be a flat key-value object (no nested objects or arrays)');
    return errors;
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string' && typeof value !== 'number' && value !== null && value !== undefined) {
      if (typeof value === 'object') {
        errors.push(`Key "${key}": secret values must be strings or scalars (no nested objects)`);
      }
    }
    if (checkNaming && !keyMatchesNamingConvention(key)) {
      errors.push(`Key "${key}": recommended format is *KeyVault (e.g. postgres-passwordKeyVault)`);
    }
  }
  return errors;
}

/**
 * Validate secrets file at path: YAML syntax, flat object, optional naming check.
 *
 * @param {string} filePath - Path to secrets file
 * @param {Object} [options] - Options
 * @param {boolean} [options.checkNaming=false] - Check key names against *KeyVault convention
 * @returns {{ valid: boolean, errors: string[], path: string }}
 */
function validateSecretsFile(filePath, options = {}) {
  const checkNaming = Boolean(options.checkNaming);
  if (!filePath || typeof filePath !== 'string') {
    return { valid: false, errors: ['Path is required'], path: '' };
  }
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    return { valid: false, errors: [`File not found: ${resolvedPath}`], path: resolvedPath };
  }
  let parsed;
  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    parsed = yaml.load(content);
  } catch (err) {
    return { valid: false, errors: [`Invalid YAML: ${err.message}`], path: resolvedPath };
  }
  const errors = validateParsedSecrets(parsed, checkNaming);
  return { valid: errors.length === 0, errors, path: resolvedPath };
}

module.exports = {
  validateSecretsFile,
  keyMatchesNamingConvention
};
