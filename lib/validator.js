/**
 * AI Fabrix Builder Schema Validation
 *
 * This module provides schema validation with developer-friendly error messages.
 * Validates variables.yaml, rbac.yaml, and env.template files.
 *
 * @fileoverview Schema validation with friendly error messages for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const applicationSchema = require('./schema/application-schema.json');

/**
 * Validates variables.yaml file against application schema
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
async function validateVariables(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const variablesPath = path.join(process.cwd(), 'builder', appName, 'variables.yaml');

  if (!fs.existsSync(variablesPath)) {
    throw new Error(`variables.yaml not found: ${variablesPath}`);
  }

  const content = fs.readFileSync(variablesPath, 'utf8');
  let variables;

  try {
    variables = yaml.load(content);
  } catch (error) {
    throw new Error(`Invalid YAML syntax in variables.yaml: ${error.message}`);
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(applicationSchema);
  const valid = validate(variables);

  return {
    valid,
    errors: valid ? [] : formatValidationErrors(validate.errors),
    warnings: []
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

async function validateRbac(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const rbacPath = path.join(process.cwd(), 'builder', appName, 'rbac.yaml');

  if (!fs.existsSync(rbacPath)) {
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
async function validateEnvTemplate(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const templatePath = path.join(process.cwd(), 'builder', appName, 'env.template');

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
    if (trimmed && !trimmed.startsWith('#')) {
      if (!trimmed.includes('=')) {
        errors.push(`Line ${index + 1}: Invalid environment variable format (missing =)`);
      } else {
        const [key, value] = trimmed.split('=', 2);
        if (!key || !value) {
          errors.push(`Line ${index + 1}: Invalid environment variable format`);
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
 * Checks the development environment for common issues
 * Validates Docker, ports, secrets, and other requirements
 *
 * @async
 * @function checkEnvironment
 * @returns {Promise<Object>} Environment check result
 * @throws {Error} If critical issues are found
 *
 * @example
 * const result = await checkEnvironment();
 * // Returns: { docker: 'ok', ports: 'ok', secrets: 'missing', recommendations: [...] }
 */
async function checkDocker() {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync('docker --version');
    await execAsync('docker-compose --version');
    return 'ok';
  } catch (error) {
    return 'error';
  }
}

async function checkPorts() {
  const requiredPorts = [5432, 6379, 5050, 8081];
  const netstat = require('net');
  let portIssues = 0;

  for (const port of requiredPorts) {
    try {
      await new Promise((resolve, reject) => {
        const server = netstat.createServer();
        server.listen(port, () => {
          server.close(resolve);
        });
        server.on('error', reject);
      });
    } catch (error) {
      portIssues++;
    }
  }

  return portIssues === 0 ? 'ok' : 'warning';
}

function checkSecrets() {
  const os = require('os');
  const secretsPath = path.join(os.homedir(), '.aifabrix', 'secrets.yaml');
  return fs.existsSync(secretsPath) ? 'ok' : 'missing';
}

async function checkEnvironment() {
  const result = {
    docker: 'unknown',
    ports: 'unknown',
    secrets: 'unknown',
    recommendations: []
  };

  // Check Docker
  result.docker = await checkDocker();
  if (result.docker === 'error') {
    result.recommendations.push('Install Docker and Docker Compose');
  }

  // Check ports
  result.ports = await checkPorts();
  if (result.ports === 'warning') {
    result.recommendations.push('Some required ports (5432, 6379, 5050, 8081) are in use');
  }

  // Check secrets
  result.secrets = checkSecrets();
  if (result.secrets === 'missing') {
    result.recommendations.push('Create secrets file: ~/.aifabrix/secrets.yaml');
  }

  return result;
}

/**
 * Formats validation errors into developer-friendly messages
 * Converts technical schema errors into actionable advice
 *
 * @function formatValidationErrors
 * @param {Array} errors - Raw validation errors from Ajv
 * @returns {Array} Formatted error messages
 *
 * @example
 * const messages = formatValidationErrors(ajvErrors);
 * // Returns: ['Port must be between 1 and 65535', 'Missing required field: displayName']
 */
function formatSingleError(error) {
  const path = error.instancePath ? error.instancePath.slice(1) : 'root';
  const field = path ? `Field "${path}"` : 'Configuration';

  const errorMessages = {
    required: `${field}: Missing required property "${error.params.missingProperty}"`,
    type: `${field}: Expected ${error.params.type}, got ${typeof error.data}`,
    minimum: `${field}: Value must be at least ${error.params.limit}`,
    maximum: `${field}: Value must be at most ${error.params.limit}`,
    minLength: `${field}: Must be at least ${error.params.limit} characters`,
    maxLength: `${field}: Must be at most ${error.params.limit} characters`,
    pattern: `${field}: Invalid format`,
    enum: `${field}: Must be one of: ${error.params.allowedValues?.join(', ') || 'unknown'}`
  };

  return errorMessages[error.keyword] || `${field}: ${error.message}`;
}

function formatValidationErrors(errors) {
  if (!Array.isArray(errors)) {
    return ['Unknown validation error'];
  }

  return errors.map(formatSingleError);
}

/**
 * Validates deployment JSON against application schema
 * Ensures generated aifabrix-deploy.json matches the schema structure
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

  const ajv = new Ajv({ allErrors: true, strict: false });
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
async function validateApplication(appName) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const variables = await validateVariables(appName);
  const rbac = await validateRbac(appName);
  const env = await validateEnvTemplate(appName);

  const valid = variables.valid && rbac.valid && env.valid;

  return {
    valid,
    variables,
    rbac,
    env,
    summary: {
      totalErrors: variables.errors.length + rbac.errors.length + env.errors.length,
      totalWarnings: variables.warnings.length + rbac.warnings.length + env.warnings.length
    }
  };
}

module.exports = {
  validateVariables,
  validateRbac,
  validateEnvTemplate,
  validateDeploymentJson,
  checkEnvironment,
  formatValidationErrors,
  validateApplication
};
