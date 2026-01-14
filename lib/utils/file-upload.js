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
async function uploadFile(url, filePath, fieldName = 'file', authConfig = {}, additionalFields = {}) {
  // Validate file exists
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read file content
  const fileContent = await fs.readFile(filePath);
  const fileName = path.basename(filePath);

  // Create FormData (available in Node.js 18+)
  // FormData is available globally in Node.js 18+
  const formData = new FormData();

  // Create a Blob from file content (Blob is available in Node.js 18+)
  const fileBlob = new Blob([fileContent], { type: 'application/octet-stream' });
  formData.append(fieldName, fileBlob, fileName);

  // Add additional fields
  for (const [key, value] of Object.entries(additionalFields)) {
    formData.append(key, String(value));
  }

  // Build headers
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

  // Note: Don't set Content-Type header - fetch will set it with boundary automatically
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

