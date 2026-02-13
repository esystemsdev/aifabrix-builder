/**
 * AI Fabrix Builder Schema Validation
 *
 * This module provides schema validation with developer-friendly error messages.
 * Validates application.yaml, rbac.yaml, and env.template files.
 *
 * @fileoverview Schema validation with friendly error messages for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const applicationSchema = require('../schema/application-schema.json');
const externalSystemSchema = require('../schema/external-system.schema.json');
const externalDataSourceSchema = require('../schema/external-datasource.schema.json');
const { transformVariablesForValidation } = require('../utils/variable-transformer');
const { checkEnvironment } = require('../utils/environment-checker');
const { formatValidationErrors } = require('../utils/error-formatter');
const { detectAppType, resolveApplicationConfigPath } = require('../utils/paths');
const { loadConfigFile } = require('../utils/config-format');

/**
 * Validates application config file against application schema
 * Provides detailed error messages for configuration issues
 *
 * @async
 * @function validateVariables
 * @param {string} appName - Name of the application
 * @returns {Promise<Object>} Validation result with errors and warnings
 * @throws {Error} If file cannot be read or parsed
 *
 * @example
 * const result = await validateVariables('myapp');
 * // Returns: { valid: true, errors: [], warnings: [] }
 */
/**
 * Loads and parses application config (application.yaml or application.json) via resolver + converter.
 * @async
 * @function loadVariablesYaml
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Variables object
 * @throws {Error} If file not found or invalid
 */
async function loadVariablesYaml(appName, options = {}) {
  const { appPath } = await detectAppType(appName, options);
  const configPath = resolveApplicationConfigPath(appPath);
  return loadConfigFile(configPath);
}

/**
 * Sets up AJV validator with external schemas
 * @function setupAjvValidator
 * @returns {Function} Compiled validator function
 */
function setupAjvValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const externalSystemSchemaCopy = { ...externalSystemSchema };
  const externalDataSourceSchemaCopy = { ...externalDataSourceSchema };

  if (externalDataSourceSchemaCopy.$schema && externalDataSourceSchemaCopy.$schema.includes('2020-12')) {
    delete externalDataSourceSchemaCopy.$schema;
  }

  ajv.addSchema(externalSystemSchemaCopy, externalSystemSchema.$id);
  ajv.addSchema(externalDataSourceSchemaCopy, externalDataSourceSchema.$id);
  return ajv.compile(applicationSchema);
}

/**
 * Validates external integration block
 * @function validateExternalIntegrationBlock
 * @param {Object} variables - Variables object
 * @param {string[]} errors - Errors array to append to
 */
function validateExternalIntegrationBlock(variables, errors) {
  if (!variables.externalIntegration) {
    errors.push('externalIntegration block is required when app.type is "external"');
    return;
  }

  if (!variables.externalIntegration.schemaBasePath) {
    errors.push('externalIntegration.schemaBasePath is required');
  }
  if (!variables.externalIntegration.systems || !Array.isArray(variables.externalIntegration.systems) || variables.externalIntegration.systems.length === 0) {
    errors.push('externalIntegration.systems must be a non-empty array');
  }
}

/**
 * Validates frontDoorRouting configuration
 * @function validateFrontDoorRouting
 * @param {Object} variables - Variables object
 * @param {string[]} errors - Errors array to append to
 */
function validateFrontDoorRouting(variables, errors) {
  const frontDoor = variables.frontDoorRouting;
  if (!frontDoor) {
    return;
  }

  if (frontDoor.enabled === true && (!frontDoor.host || typeof frontDoor.host !== 'string')) {
    errors.push('frontDoorRouting.host is required when frontDoorRouting.enabled is true');
  }

  if (frontDoor.pattern && !String(frontDoor.pattern).startsWith('/')) {
    errors.push('frontDoorRouting.pattern must start with "/"');
  }
}

async function validateVariables(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const variables = await loadVariablesYaml(appName, options);
  const transformed = transformVariablesForValidation(variables, appName);
  const validate = setupAjvValidator();
  const valid = validate(transformed);

  const errors = valid ? [] : formatValidationErrors(validate.errors);
  const warnings = [];

  if (variables.app && variables.app.type === 'external') {
    validateExternalIntegrationBlock(variables, errors);
  }

  validateFrontDoorRouting(variables, errors);

  return {
    valid: valid && errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates rbac.yaml file structure and content
 * Ensures roles and permissions are properly defined
 *
 * @async
 * @function validateRbac
 * @param {string} appName - Name of the application
 * @returns {Promise<Object>} Validation result with errors and warnings
 * @throws {Error} If file cannot be read or parsed
 *
 * @example
 * const result = await validateRbac('myapp');
 * // Returns: { valid: true, errors: [], warnings: [] }
 */
function validateRoles(roles) {
  const errors = [];
  if (!roles || !Array.isArray(roles)) {
    errors.push('rbac.yaml must contain a "roles" array');
    return errors;
  }

  const roleNames = new Set();
  roles.forEach((role, index) => {
    if (!role.name || !role.value || !role.description) {
      errors.push(`Role at index ${index} is missing required fields (name, value, description)`);
    } else if (roleNames.has(role.value)) {
      errors.push(`Duplicate role value: ${role.value}`);
    } else {
      roleNames.add(role.value);
    }
    // Reject Groups (capital G) - must use groups (lowercase)
    if (role.Groups !== undefined) {
      errors.push(`Role at index ${index} uses 'Groups' (capital G) but must use 'groups' (lowercase) for schema compatibility`);
    }
  });
  return errors;
}

function validatePermissions(permissions) {
  const errors = [];
  if (!permissions || !Array.isArray(permissions)) {
    errors.push('rbac.yaml must contain a "permissions" array');
    return errors;
  }

  const permissionNames = new Set();
  permissions.forEach((permission, index) => {
    if (!permission.name || !permission.roles || !permission.description) {
      errors.push(`Permission at index ${index} is missing required fields (name, roles, description)`);
    } else if (permissionNames.has(permission.name)) {
      errors.push(`Duplicate permission name: ${permission.name}`);
    } else {
      permissionNames.add(permission.name);
    }
  });
  return errors;
}

async function validateRbac(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  // Support both builder/ and integration/ directories using detectAppType
  const { appPath } = await detectAppType(appName, options);
  const rbacYaml = path.join(appPath, 'rbac.yaml');
  const rbacYml = path.join(appPath, 'rbac.yml');
  const rbacPath = fs.existsSync(rbacYaml) ? rbacYaml : (fs.existsSync(rbacYml) ? rbacYml : null);

  if (!rbacPath) {
    return { valid: true, errors: [], warnings: ['rbac.yaml not found - authentication disabled'] };
  }

  const content = fs.readFileSync(rbacPath, 'utf8');
  let rbac;

  try {
    rbac = yaml.load(content);
  } catch (error) {
    throw new Error(`Invalid YAML syntax in rbac.yaml: ${error.message}`);
  }

  const errors = [
    ...validateRoles(rbac.roles),
    ...validatePermissions(rbac.permissions)
  ];

  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
}

/**
 * Validates env.template file for proper kv:// references
 * Checks for syntax errors and missing secret references
 *
 * @async
 * @function validateEnvTemplate
 * @param {string} appName - Name of the application
 * @returns {Promise<Object>} Validation result with errors and warnings
 * @throws {Error} If file cannot be read
 *
 * @example
 * const result = await validateEnvTemplate('myapp');
 * // Returns: { valid: true, errors: [], warnings: [] }
 */
async function validateEnvTemplate(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  // Support both builder/ and integration/ directories using detectAppType
  const { appPath } = await detectAppType(appName, options);
  const templatePath = path.join(appPath, 'env.template');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`env.template not found: ${templatePath}`);
  }

  const content = fs.readFileSync(templatePath, 'utf8');
  const errors = [];
  const warnings = [];

  // Check for valid environment variable syntax
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (trimmed && !trimmed.startsWith('#')) {
      if (!trimmed.includes('=')) {
        errors.push(`Line ${index + 1}: Invalid environment variable format (missing =)`);
      } else {
        const [key, _value] = trimmed.split('=', 2);
        // Trim key to handle whitespace issues
        // Empty values are allowed (_value can be empty string or undefined)
        const trimmedKey = key ? key.trim() : '';
        if (!trimmedKey) {
          errors.push(`Line ${index + 1}: Invalid environment variable format (missing variable name)`);
        }
      }
    }
  });

  // Check for kv:// reference format
  const kvPattern = /kv:\/\/([a-zA-Z0-9-_]+)/g;
  let match;
  while ((match = kvPattern.exec(content)) !== null) {
    const secretKey = match[1];
    if (!secretKey) {
      errors.push('Invalid kv:// reference format');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a single object against the application schema (no app-name resolution).
 * Supports both flat root (key, displayName, ...) and nested shape (app: {...}).
 * Used by diff and other callers that have already parsed the config.
 *
 * @function validateObjectAgainstApplicationSchema
 * @param {Object} obj - Parsed config object (root or { app, deployment })
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 *
 * @example
 * const result = validateObjectAgainstApplicationSchema(parsed);
 * if (!result.valid) throw new Error(result.errors.join('; '));
 */
function validateObjectAgainstApplicationSchema(obj) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }
  const toValidate = obj.app && typeof obj.app === 'object' && !obj.key ? obj.app : obj;
  const validate = setupAjvValidator();
  const valid = validate(toValidate);
  return {
    valid: !!valid,
    errors: valid ? [] : formatValidationErrors(validate.errors)
  };
}

/**
 * Validates deployment JSON against application schema
 * Ensures generated <app-name>-deploy.json matches the schema structure
 *
 * @function validateDeploymentJson
 * @param {Object} deployment - Deployment JSON object to validate
 * @returns {Object} Validation result with errors
 *
 * @example
 * const result = validateDeploymentJson(deployment);
 * // Returns: { valid: true, errors: [] }
 */
function validateDeploymentJson(deployment) {
  if (!deployment || typeof deployment !== 'object') {
    return {
      valid: false,
      errors: ['Deployment must be an object']
    };
  }

  // verbose: true includes the actual data value in error objects for better error messages
  const ajv = new Ajv({ allErrors: true, strict: false, verbose: true });
  // Register external schemas with their $id (GitHub raw URLs)
  // Create copies to avoid modifying the original schemas
  const externalSystemSchemaCopy = { ...externalSystemSchema };
  const externalDataSourceSchemaCopy = { ...externalDataSourceSchema };
  // Remove $schema for draft-2020-12 to avoid AJV issues
  if (externalDataSourceSchemaCopy.$schema && externalDataSourceSchemaCopy.$schema.includes('2020-12')) {
    delete externalDataSourceSchemaCopy.$schema;
  }
  ajv.addSchema(externalSystemSchemaCopy, externalSystemSchema.$id);
  ajv.addSchema(externalDataSourceSchemaCopy, externalDataSourceSchema.$id);
  const validate = ajv.compile(applicationSchema);
  const valid = validate(deployment);

  return {
    valid,
    errors: valid ? [] : formatValidationErrors(validate.errors)
  };
}

/**
 * Validates all application configuration files
 * Runs complete validation suite for an application
 *
 * @async
 * @function validateApplication
 * @param {string} appName - Name of the application
 * @returns {Promise<Object>} Complete validation result
 * @throws {Error} If validation fails
 *
 * @example
 * const result = await validateApplication('myapp');
 * // Returns: { valid: true, variables: {...}, rbac: {...}, env: {...} }
 */
async function validateApplication(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const variables = await validateVariables(appName, options);
  const rbac = await validateRbac(appName, options);
  const env = await validateEnvTemplate(appName, options);

  const valid = variables.valid && rbac.valid && env.valid;
  const errors = [...(variables.errors || []), ...(rbac.errors || []), ...(env.errors || [])];
  const warnings = [...(variables.warnings || []), ...(rbac.warnings || []), ...(env.warnings || [])];

  return {
    valid,
    variables,
    rbac,
    env,
    errors,
    warnings,
    summary: {
      totalErrors: errors.length,
      totalWarnings: warnings.length
    }
  };
}

module.exports = {
  validateVariables,
  validateRbac,
  validateEnvTemplate,
  validateDeploymentJson,
  validateObjectAgainstApplicationSchema,
  checkEnvironment,
  formatValidationErrors,
  validateApplication
};
