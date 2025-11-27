/**
 * Datasource Validation
 *
 * Validates external datasource JSON files against schema.
 *
 * @fileoverview Datasource validation for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const { loadExternalDataSourceSchema } = require('./utils/schema-loader');
const { formatValidationErrors } = require('./utils/error-formatter');

/**
 * Validates a datasource file against external-datasource schema
 *
 * @async
 * @function validateDatasourceFile
 * @param {string} filePath - Path to the datasource JSON file
 * @returns {Promise<Object>} Validation result with errors and warnings
 * @throws {Error} If file cannot be read or parsed
 *
 * @example
 * const result = await validateDatasourceFile('./hubspot-deal.json');
 * // Returns: { valid: true, errors: [], warnings: [] }
 */
async function validateDatasourceFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required and must be a string');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid JSON syntax: ${error.message}`],
      warnings: []
    };
  }

  const validate = loadExternalDataSourceSchema();
  const valid = validate(parsed);

  return {
    valid,
    errors: valid ? [] : formatValidationErrors(validate.errors),
    warnings: []
  };
}

module.exports = {
  validateDatasourceFile
};

