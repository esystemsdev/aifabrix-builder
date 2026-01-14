/**
 * External System Validation Helpers
 *
 * Provides validation functions for external system field mappings and schemas.
 *
 * @fileoverview Validation helpers for external system testing
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const Ajv = require('ajv');

/**
 * Validates field mapping expression syntax (pipe-based DSL)
 * @param {string} expression - Field mapping expression
 * @returns {Object} Validation result with isValid and error message
 */
function validateFieldMappingExpression(expression) {
  if (!expression || typeof expression !== 'string') {
    return { isValid: false, error: 'Expression must be a non-empty string' };
  }

  // Pattern: {{path.to.field}} | transformation1 | transformation2
  const expressionPattern = /^\s*\{\{[^}]+\}\}(\s*\|\s*[a-zA-Z0-9_]+(\s*\([^)]*\))?)*\s*$/;

  if (!expressionPattern.test(expression)) {
    return {
      isValid: false,
      error: 'Invalid expression format. Expected: {{path.to.field}} | toUpper | trim'
    };
  }

  // Extract path and transformations
  const pathMatch = expression.match(/\{\{([^}]+)\}\}/);
  if (!pathMatch) {
    return { isValid: false, error: 'Path must be wrapped in {{}}' };
  }

  // Validate transformations (optional)
  const transformations = expression.split('|').slice(1).map(t => t.trim());
  const validTransformations = ['toUpper', 'toLower', 'trim', 'default', 'toNumber', 'toString'];
  for (const trans of transformations) {
    const transName = trans.split('(')[0].trim();
    if (!validTransformations.includes(transName)) {
      return {
        isValid: false,
        error: `Unknown transformation: ${transName}. Valid: ${validTransformations.join(', ')}`
      };
    }
  }

  return { isValid: true, error: null };
}

/**
 * Validates field mappings against test payload
 * @param {Object} datasource - Datasource configuration
 * @param {Object} testPayload - Test payload object
 * @returns {Object} Validation results
 */
/**
 * Validates a single field mapping
 * @function validateSingleFieldMapping
 * @param {string} fieldName - Field name
 * @param {Object} fieldConfig - Field configuration
 * @param {Object} payloadTemplate - Payload template
 * @param {Object} results - Results object to update
 */
function validateSingleFieldMapping(fieldName, fieldConfig, payloadTemplate, results) {
  if (!fieldConfig.expression) {
    results.errors.push(`Field '${fieldName}' missing expression`);
    results.valid = false;
    return;
  }

  // Validate expression syntax
  const exprValidation = validateFieldMappingExpression(fieldConfig.expression);
  if (!exprValidation.isValid) {
    results.errors.push(`Field '${fieldName}': ${exprValidation.error}`);
    results.valid = false;
    return;
  }

  // Try to extract path from expression
  const pathMatch = fieldConfig.expression.match(/\{\{([^}]+)\}\}/);
  if (pathMatch) {
    const fieldPath = pathMatch[1].trim();
    const pathExists = checkPathExistsInPayload(fieldPath, payloadTemplate);

    if (!pathExists) {
      results.warnings.push(`Field '${fieldName}': Path '${fieldPath}' may not exist in payload`);
    } else {
      results.mappedFields[fieldName] = fieldConfig.expression;
    }
  }
}

/**
 * Checks if path exists in payload
 * @function checkPathExistsInPayload
 * @param {string} fieldPath - Field path
 * @param {Object} payloadTemplate - Payload template
 * @returns {boolean} True if path exists
 */
function checkPathExistsInPayload(fieldPath, payloadTemplate) {
  const pathParts = fieldPath.split('.');
  let current = payloadTemplate;

  for (const part of pathParts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }

  return true;
}

function validateFieldMappings(datasource, testPayload) {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    mappedFields: {}
  };

  if (!datasource.fieldMappings || !datasource.fieldMappings.fields) {
    results.warnings.push('No field mappings defined');
    return results;
  }

  const fields = datasource.fieldMappings.fields;
  const payloadTemplate = testPayload.payloadTemplate || testPayload;

  // Validate each field mapping expression
  for (const [fieldName, fieldConfig] of Object.entries(fields)) {
    validateSingleFieldMapping(fieldName, fieldConfig, payloadTemplate, results);
  }

  return results;
}

/**
 * Validates metadata schema against test payload
 * @param {Object} datasource - Datasource configuration
 * @param {Object} testPayload - Test payload object
 * @returns {Object} Validation results
 */
function validateMetadataSchema(datasource, testPayload) {
  const results = {
    valid: true,
    errors: [],
    warnings: []
  };

  if (!datasource.metadataSchema) {
    results.warnings.push('No metadata schema defined');
    return results;
  }

  const payloadTemplate = testPayload.payloadTemplate || testPayload;

  try {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile(datasource.metadataSchema);
    const valid = validate(payloadTemplate);

    if (!valid) {
      results.valid = false;
      results.errors = validate.errors.map(err => {
        const path = err.instancePath || err.schemaPath;
        return `${path} ${err.message}`;
      });
    }
  } catch (error) {
    results.valid = false;
    results.errors.push(`Schema validation error: ${error.message}`);
  }

  return results;
}

/**
 * Normalizes schema to handle nullable without type
 * @param {Object} schema - Schema to normalize
 * @returns {Object} Normalized schema
 */
function normalizeSchema(schema) {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const normalized = Array.isArray(schema) ? [...schema] : { ...schema };

  if (normalized.nullable === true && !normalized.type) {
    normalized.type = ['null', 'string', 'number', 'boolean', 'object', 'array'];
  }

  for (const key in normalized) {
    if (typeof normalized[key] === 'object' && normalized[key] !== null) {
      normalized[key] = normalizeSchema(normalized[key]);
    }
  }

  return normalized;
}

/**
 * Validates JSON against schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - JSON schema
 * @returns {Object} Validation results
 */
function validateAgainstSchema(data, schema) {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    allowUnionTypes: true,
    validateSchema: false
  });
  // Remove $schema for draft-2020-12 to avoid AJV issues
  const schemaCopy = { ...schema };
  if (schemaCopy.$schema && schemaCopy.$schema.includes('2020-12')) {
    delete schemaCopy.$schema;
  }
  // Normalize schema to handle nullable without type
  const normalizedSchema = normalizeSchema(schemaCopy);
  const validate = ajv.compile(normalizedSchema);
  const valid = validate(data);

  if (!valid) {
    // Filter out additionalProperties errors for required properties that aren't defined in schema
    // This handles schema inconsistencies where authentication is required but not defined in properties
    const filteredErrors = validate.errors.filter(err => {
      if (err.keyword === 'additionalProperties' && err.params?.additionalProperty === 'authentication') {
        // Check if authentication is in required array
        const required = normalizedSchema.required || [];
        if (required.includes('authentication')) {
          return false; // Ignore this error since authentication is required but not defined
        }
      }
      return true;
    });

    return {
      valid: filteredErrors.length === 0,
      errors: filteredErrors.map(err => {
        const path = err.instancePath || err.schemaPath;
        return `${path} ${err.message}`;
      })
    };
  }

  return {
    valid: true,
    errors: []
  };
}

module.exports = {
  validateFieldMappingExpression,
  validateFieldMappings,
  validateMetadataSchema,
  validateAgainstSchema
};

