/**
 * @fileoverview File upload utilities for multipart/form-data requests
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const { makeApiCall, authenticatedApiCall } = require('./api');

/**
 * Upload a file using multipart/form-data
 * @async
 * @function uploadFile
 * @param {string} url - API endpoint URL
 * @param {string} filePath - Path to file to upload
 * @param {string} fieldName - Form field name for the file (default: 'file')
 * @param {Object} [authConfig] - Authentication configuration
 * @param {string} [authConfig.type] - Auth type ('bearer' | 'client-credentials')
 * @param {string} [authConfig.token] - Bearer token
 * @param {string} [authConfig.clientId] - Client ID
 * @param {string} [authConfig.clientSecret] - Client secret
 * @param {Object} [additionalFields] - Additional form fields to include
 * @returns {Promise<Object>} API response
 * @throws {Error} If file upload fails
 */
/**
 * Validates file exists
 * @async
 * @function validateFileExists
 * @param {string} filePath - File path
 * @throws {Error} If file not found
 */
async function validateFileExists(filePath) {
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error(`File not found: ${filePath}`);
  }
}

/**
 * Builds FormData with file and additional fields
 * @async
 * @function buildFormData
 * @param {string} filePath - File path
 * @param {string} fieldName - Field name
 * @param {Object} additionalFields - Additional fields
 * @returns {Promise<FormData>} FormData object
 */
async function buildFormData(filePath, fieldName, additionalFields) {
  const formData = new FormData();
  const fileContent = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  const fileBlob = new Blob([fileContent], { type: 'application/octet-stream' });
  formData.append(fieldName, fileBlob, fileName);

  for (const [key, value] of Object.entries(additionalFields)) {
    formData.append(key, String(value));
  }

  return formData;
}

/**
 * Builds authentication headers
 * @function buildAuthHeaders
 * @param {Object} authConfig - Authentication configuration
 * @returns {Object} Headers object
 */
function buildAuthHeaders(authConfig) {
  const headers = {};
  if (authConfig.type === 'bearer' && authConfig.token) {
    headers['Authorization'] = `Bearer ${authConfig.token}`;
  } else if (authConfig.type === 'client-credentials') {
    if (authConfig.clientId) {
      headers['x-client-id'] = authConfig.clientId;
    }
    if (authConfig.clientSecret) {
      headers['x-client-secret'] = authConfig.clientSecret;
    }
  }
  return headers;
}

async function uploadFile(url, filePath, fieldName = 'file', authConfig = {}, additionalFields = {}) {
  await validateFileExists(filePath);

  const formData = await buildFormData(filePath, fieldName, additionalFields);
  const headers = buildAuthHeaders(authConfig);

  const options = {
    method: 'POST',
    headers,
    body: formData
  };

  // Use authenticatedApiCall if bearer token, otherwise makeApiCall
  if (authConfig.type === 'bearer' && authConfig.token) {
    return await authenticatedApiCall(url, options, authConfig.token);
  }

  return await makeApiCall(url, options);
}

module.exports = {
  uploadFile
};

