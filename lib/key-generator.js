/**
 * AI Fabrix Builder Deployment Key Generator
 *
 * This module generates SHA256-based deployment keys for controller authentication.
 * Keys are computed from variables.yaml content to ensure deployment integrity.
 *
 * @fileoverview Deployment key generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generates deployment key from variables.yaml content
 * Creates SHA256 hash for controller authentication and deployment integrity
 *
 * @async
 * @function generateDeploymentKey
 * @param {string} appName - Name of the application
 * @returns {Promise<string>} SHA256 hash of variables.yaml content
 * @throws {Error} If variables.yaml cannot be read
 *
 * @example
 * const key = await generateDeploymentKey('myapp');
 * // Returns: 'a1b2c3d4e5f6...' (64-character SHA256 hash)
 */
async function generateDeploymentKey(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');

  if (!fs.existsSync(variablesPath)) {
    throw new Error(`variables.yaml not found: ${variablesPath}`);
  }

  const content = fs.readFileSync(variablesPath, 'utf8');
  return generateDeploymentKeyFromContent(content);
}

/**
 * Generates deployment key from raw variables.yaml content
 * Useful for testing or when content is already loaded
 *
 * @function generateDeploymentKeyFromContent
 * @param {string} content - Raw variables.yaml content
 * @returns {string} SHA256 hash of content
 *
 * @example
 * const key = generateDeploymentKeyFromContent(yamlContent);
 * // Returns: 'a1b2c3d4e5f6...' (64-character SHA256 hash)
 */
function generateDeploymentKeyFromContent(content) {
  if (typeof content !== 'string') {
    throw new Error('Content is required and must be a string');
  }

  const hash = crypto.createHash('sha256');
  hash.update(content, 'utf8');
  return hash.digest('hex');
}

/**
 * Validates deployment key format
 * Ensures key is a valid SHA256 hash
 *
 * @function validateDeploymentKey
 * @param {string} key - Deployment key to validate
 * @returns {boolean} True if key is valid SHA256 hash
 *
 * @example
 * const isValid = validateDeploymentKey('a1b2c3d4e5f6...');
 * // Returns: true
 */
function validateDeploymentKey(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }

  // SHA256 produces 64-character hex string
  const sha256Pattern = /^[a-f0-9]{64}$/i;
  return sha256Pattern.test(key);
}

module.exports = {
  generateDeploymentKey,
  generateDeploymentKeyFromContent,
  validateDeploymentKey
};
