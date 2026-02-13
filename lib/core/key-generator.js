/**
 * AI Fabrix Builder Deployment Key Generator
 *
 * This module generates SHA256-based deployment keys for controller authentication.
 * Keys are computed from application config content to ensure deployment integrity.
 *
 * @fileoverview Deployment key generation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generates deployment key from application config content
 * Creates SHA256 hash for controller authentication and deployment integrity
 *
 * @async
 * @function generateDeploymentKey
 * @param {string} appName - Name of the application
 * @returns {Promise<string>} SHA256 hash of application config content
 * @throws {Error} If application config cannot be read
 *
 * @example
 * const key = await generateDeploymentKey('myapp');
 * // Returns: 'a1b2c3d4e5f6...' (64-character SHA256 hash)
 */
async function generateDeploymentKey(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
  const builderPath = path.join(process.cwd(), 'builder', appName);
  const variablesPath = resolveApplicationConfigPath(builderPath);
  const content = fs.readFileSync(variablesPath, 'utf8');
  return generateDeploymentKeyFromContent(content);
}

/**
 * Generates deployment key from raw application config content
 * Useful for testing or when content is already loaded
 *
 * @function generateDeploymentKeyFromContent
 * @param {string} content - Raw application config content
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
 * Recursively sorts object keys for deterministic JSON stringification
 * @param {*} obj - Object to sort
 * @returns {*} Object with sorted keys
 */
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sortObjectKeys(item));
  }

  const sorted = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key]);
  }
  return sorted;
}

/**
 * Generates deployment key from deployment manifest object
 * Creates SHA256 hash of manifest (excluding deploymentKey field) for integrity verification
 * Uses deterministic JSON stringification (sorted keys, no whitespace)
 *
 * @function generateDeploymentKeyFromJson
 * @param {Object} deploymentObject - Deployment manifest object
 * @returns {string} SHA256 hash of manifest (64-character hex string)
 * @throws {Error} If deploymentObject is invalid
 *
 * @example
 * const key = generateDeploymentKeyFromJson(deploymentManifest);
 * // Returns: 'a1b2c3d4e5f6...' (64-character SHA256 hash)
 */
function generateDeploymentKeyFromJson(deploymentObject) {
  if (!deploymentObject || typeof deploymentObject !== 'object') {
    throw new Error('Deployment object is required and must be an object');
  }

  // Create a copy and remove deploymentKey field if present
  const manifestCopy = { ...deploymentObject };
  delete manifestCopy.deploymentKey;

  // Sort all keys recursively for deterministic JSON stringification
  const sortedManifest = sortObjectKeys(manifestCopy);

  // Deterministic JSON stringification: sorted keys, no whitespace
  const jsonString = JSON.stringify(sortedManifest);

  // Generate SHA256 hash
  const hash = crypto.createHash('sha256');
  hash.update(jsonString, 'utf8');
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
  generateDeploymentKeyFromJson,
  validateDeploymentKey
};
