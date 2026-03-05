/**
 * @fileoverview File upload utilities for multipart/form-data requests
 * All API calls go via ApiClient (lib/api/index.js); no duplicate auth logic.
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const { ApiClient } = require('../api');

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
 * Upload a file using multipart/form-data via ApiClient (single place for auth and API calls).
 * @async
 * @function uploadFile
 * @param {string} url - Full API endpoint URL (e.g. https://dataplane.example.com/api/v1/wizard/parse-openapi)
 * @param {string} filePath - Path to file to upload
 * @param {string} fieldName - Form field name for the file (default: 'file')
 * @param {Object} [authConfig] - Authentication configuration (token-only for app endpoints)
 * @param {string} [authConfig.type] - Auth type ('bearer' | 'client-token')
 * @param {string} [authConfig.token] - Token (Bearer user token or x-client-token application token)
 * @param {Object} [additionalFields] - Additional form fields to include
 * @returns {Promise<Object>} API response
 * @throws {Error} If file upload fails
 */
async function uploadFile(url, filePath, fieldName = 'file', authConfig = {}, additionalFields = {}) {
  await validateFileExists(filePath);

  const parsed = new URL(url);
  const baseUrl = parsed.origin;
  const endpointPath = parsed.pathname + parsed.search;

  const formData = await buildFormData(filePath, fieldName, additionalFields);
  const client = new ApiClient(baseUrl, authConfig);

  return await client.postFormData(endpointPath, formData);
}

module.exports = {
  uploadFile
};
