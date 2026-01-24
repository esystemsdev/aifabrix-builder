/**
 * External System Manifest Validator
 *
 * Validates controller deployment manifest for external systems.
 * Validates against application-schema.json and component schemas.
 *
 * @fileoverview Manifest validation for external systems
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');
const { formatValidationErrors } = require('../utils/error-formatter');

/**
 * Sets up AJV validator with external schemas
 * @async
 * @function setupAjvWithSchemas
 * @returns {Promise<Object>} AJV instance and schemas
 */
async function setupAjvWithSchemas() {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    removeAdditional: false
  });

  // Load raw schema objects (not compiled validators)
  const externalSystemSchemaPath = path.join(__dirname, '..', 'schema', 'external-system.schema.json');
  const externalDatasourceSchemaPath = path.join(__dirname, '..', 'schema', 'external-datasource.schema.json');

  const externalSystemSchema = JSON.parse(fs.readFileSync(externalSystemSchemaPath, 'utf8'));
  let externalDatasourceSchema = JSON.parse(fs.readFileSync(externalDatasourceSchemaPath, 'utf8'));

  // Remove $schema for draft-2020-12 to avoid AJV issues
  if (externalDatasourceSchema.$schema && externalDatasourceSchema.$schema.includes('2020-12')) {
    const schemaCopy = { ...externalDatasourceSchema };
    delete schemaCopy.$schema;
    externalDatasourceSchema = schemaCopy;
  }

  const externalSystemSchemaId = externalSystemSchema.$id || 'https://raw.githubusercontent.com/esystemsdev/aifabrix-builder/refs/heads/main/lib/schema/external-system.schema.json';
  const externalDatasourceSchemaId = externalDatasourceSchema.$id || 'https://raw.githubusercontent.com/esystemsdev/aifabrix-builder/refs/heads/main/lib/schema/external-datasource.schema.json';

  ajv.addSchema(externalSystemSchema, externalSystemSchemaId);
  ajv.addSchema(externalDatasourceSchema, externalDatasourceSchemaId);

  return { ajv, externalSystemSchema, externalDatasourceSchema };
}

/**
 * Validates manifest structure
 * @function validateManifestStructure
 * @param {Object} manifest - Manifest object
 * @param {Object} ajv - AJV instance
 * @param {Object} applicationSchema - Application schema
 * @param {Array} errors - Errors array to append to
 * @returns {void}
 */
function validateManifestStructure(manifest, ajv, applicationSchema, errors) {
  const validateManifest = ajv.compile(applicationSchema);
  const manifestValid = validateManifest(manifest);

  if (!manifestValid) {
    const manifestErrors = formatValidationErrors(validateManifest.errors);
    errors.push(...manifestErrors.map(err => `Manifest validation: ${err}`));
  }
}

/**
 * Validates inline system
 * @function validateInlineSystem
 * @param {Object} manifest - Manifest object
 * @param {Object} ajv - AJV instance
 * @param {Object} externalSystemSchema - External system schema
 * @param {Array} errors - Errors array to append to
 * @returns {void}
 */
function validateInlineSystem(manifest, ajv, externalSystemSchema, errors) {
  if (manifest.system) {
    const validateSystem = ajv.compile(externalSystemSchema);
    const systemValid = validateSystem(manifest.system);

    if (!systemValid) {
      const systemErrors = formatValidationErrors(validateSystem.errors);
      errors.push(...systemErrors.map(err => `System validation: ${err}`));
    }
  } else if (manifest.type === 'external') {
    errors.push('System is required for external type applications');
  }
}

/**
 * Validates datasources
 * @function validateDatasources
 * @param {Object} manifest - Manifest object
 * @param {Object} ajv - AJV instance
 * @param {Object} externalDatasourceSchema - External datasource schema
 * @param {Array} errors - Errors array to append to
 * @param {Array} warnings - Warnings array to append to
 * @returns {void}
 */
function validateDatasources(manifest, ajv, externalDatasourceSchema, errors, warnings) {
  if (manifest.dataSources) {
    if (!Array.isArray(manifest.dataSources)) {
      errors.push('dataSources must be an array');
    } else {
      const validateDatasource = ajv.compile(externalDatasourceSchema);
      manifest.dataSources.forEach((datasource, index) => {
        const datasourceValid = validateDatasource(datasource);
        if (!datasourceValid) {
          const datasourceErrors = formatValidationErrors(validateDatasource.errors);
          errors.push(...datasourceErrors.map(err => `Datasource ${index + 1} (${datasource.key || 'unknown'}): ${err}`));
        }
      });
    }
  } else if (manifest.type === 'external') {
    warnings.push('No dataSources specified - external system may not have any datasources');
  }
}

/**
 * Validates conditional requirements
 * @function validateConditionalRequirements
 * @param {Object} manifest - Manifest object
 * @param {Array} errors - Errors array to append to
 * @param {Array} warnings - Warnings array to append to
 * @returns {void}
 */
function validateConditionalRequirements(manifest, errors, warnings) {
  if (manifest.type === 'external') {
    if (!manifest.system) {
      errors.push('System is required for external type applications');
    }
    if (!manifest.dataSources || manifest.dataSources.length === 0) {
      warnings.push('No dataSources specified for external system');
    }
  }
}

/**
 * Validates required fields
 * @function validateRequiredFields
 * @param {Object} manifest - Manifest object
 * @param {Array} errors - Errors array to append to
 * @returns {void}
 */
function validateRequiredFields(manifest, errors) {
  const requiredFields = ['key', 'displayName', 'description', 'type', 'deploymentKey'];
  requiredFields.forEach(field => {
    if (!manifest[field]) {
      errors.push(`Required field "${field}" is missing`);
    }
  });
}

/**
 * Validates controller deployment manifest for external systems
 * Validates manifest structure and inline system/dataSources against their schemas
 *
 * @async
 * @function validateControllerManifest
 * @param {Object} manifest - Controller manifest object
 * @returns {Promise<Object>} Validation result
 * @throws {Error} If validation fails critically
 *
 * @example
 * const result = await validateControllerManifest(manifest);
 * // Returns: { valid: true, errors: [], warnings: [] }
 */
async function validateControllerManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return {
      valid: false,
      errors: ['Manifest is required and must be an object'],
      warnings: []
    };
  }

  const errors = [];
  const warnings = [];
  const applicationSchema = require('../schema/application-schema.json');
  const { ajv, externalSystemSchema, externalDatasourceSchema } = await setupAjvWithSchemas();

  validateManifestStructure(manifest, ajv, applicationSchema, errors);
  validateInlineSystem(manifest, ajv, externalSystemSchema, errors);
  validateDatasources(manifest, ajv, externalDatasourceSchema, errors, warnings);
  validateConditionalRequirements(manifest, errors, warnings);
  validateRequiredFields(manifest, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  validateControllerManifest
};
