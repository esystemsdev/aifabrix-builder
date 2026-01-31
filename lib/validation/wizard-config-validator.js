/**
 * @fileoverview Wizard configuration validator for wizard.yaml files
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');
const wizardConfigSchema = require('../schema/wizard-config.schema.json');

/**
 * Resolve environment variable references in a value
 * Supports ${VAR_NAME} syntax
 * @function resolveEnvVar
 * @param {string} value - Value that may contain env var references
 * @returns {string} Resolved value
 */
function resolveEnvVar(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable '${varName}' is not defined`);
    }
    return envValue;
  });
}

/**
 * Recursively resolve environment variables in an object
 * @function resolveEnvVarsInObject
 * @param {Object} obj - Object to process
 * @returns {Object} Object with resolved env vars
 */
function resolveEnvVarsInObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'string') {
    return resolveEnvVar(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => resolveEnvVarsInObject(item));
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvVarsInObject(value);
    }
    return result;
  }
  return obj;
}

/**
 * Format AJV validation errors into user-friendly messages
 * @function formatValidationErrors
 * @param {Object[]} errors - AJV validation errors
 * @returns {string[]} Formatted error messages
 */
function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return [];
  }
  return errors.map(error => {
    const path = error.instancePath || '/';
    const message = error.message || 'Unknown validation error';
    if (error.keyword === 'required') {
      return `Missing required field: ${error.params.missingProperty}`;
    }
    if (error.keyword === 'enum') {
      return `${path}: ${message}. Allowed values: ${error.params.allowedValues.join(', ')}`;
    }
    if (error.keyword === 'pattern') {
      return `${path}: ${message}`;
    }
    if (error.keyword === 'additionalProperties') {
      return `${path}: Unknown property '${error.params.additionalProperty}'`;
    }
    return `${path}: ${message}`;
  });
}

/**
 * Load and parse wizard.yaml file
 * @async
 * @function loadWizardConfig
 * @param {string} configPath - Path to wizard.yaml file
 * @returns {Promise<Object>} Parsed configuration object
 * @throws {Error} If file cannot be read or parsed
 */
async function loadWizardConfig(configPath) {
  const resolvedPath = path.resolve(configPath);
  try {
    await fs.access(resolvedPath);
    const content = await fs.readFile(resolvedPath, 'utf8');
    const config = yaml.load(content);
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration file is empty or invalid');
    }
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${resolvedPath}`);
    }
    if (error.name === 'YAMLException') {
      throw new Error(`Invalid YAML syntax: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Write wizard configuration to wizard.yaml (creates directory if needed).
 * @async
 * @function writeWizardConfig
 * @param {string} configPath - Path to wizard.yaml file
 * @param {Object} config - Configuration object to write (will be dumped as YAML)
 * @returns {Promise<void>}
 * @throws {Error} If write fails
 */
async function writeWizardConfig(configPath, config) {
  const resolvedPath = path.resolve(configPath);
  const dir = path.dirname(resolvedPath);
  await fs.mkdir(dir, { recursive: true });
  const content = yaml.dump(config, { lineWidth: -1 });
  await fs.writeFile(resolvedPath, content, 'utf8');
}

/**
 * Check if wizard.yaml exists at path
 * @async
 * @function wizardConfigExists
 * @param {string} configPath - Path to wizard.yaml file
 * @returns {Promise<boolean>}
 */
async function wizardConfigExists(configPath) {
  try {
    await fs.access(path.resolve(configPath));
    return true;
  } catch (error) {
    return error.code === 'ENOENT' ? false : Promise.reject(error);
  }
}

/**
 * Validate wizard configuration against schema
 * @function validateWizardConfigSchema
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result with valid flag and errors
 */
function validateWizardConfigSchema(config) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(wizardConfigSchema);
  const valid = validate(config);
  return {
    valid,
    errors: valid ? [] : formatValidationErrors(validate.errors)
  };
}

/**
 * Validate file path exists (for openapi-file source type)
 * @function validateFilePath
 * @param {string} filePath - Path to validate
 * @param {string} basePath - Base path for relative paths
 * @returns {Promise<Object>} Validation result with valid flag and errors
 */
async function validateFilePath(filePath, basePath) {
  const baseDir = path.resolve(basePath);
  const resolvedPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(baseDir, filePath);
  if (!path.isAbsolute(filePath)) {
    const baseWithSep = baseDir.endsWith(path.sep) ? baseDir : `${baseDir}${path.sep}`;
    if (!resolvedPath.startsWith(baseWithSep)) {
      return {
        valid: false,
        errors: [`OpenAPI file path must be within: ${baseDir}`]
      };
    }
  }
  try {
    await fs.access(resolvedPath);
  } catch (error) {
    return {
      valid: false,
      errors: [`OpenAPI file not found: ${resolvedPath}`]
    };
  }
  return { valid: true, errors: [] };
}

/**
 * Validate schema and resolve environment variables
 * @function validateSchemaAndResolveEnvVars
 * @param {Object} config - Configuration object
 * @param {boolean} shouldResolveEnvVars - Whether to resolve env vars
 * @returns {Object} Result with valid flag, errors, and config
 */
function validateSchemaAndResolveEnvVars(config, shouldResolveEnvVars) {
  if (shouldResolveEnvVars) {
    try {
      config = resolveEnvVarsInObject(config);
    } catch (error) {
      return { valid: false, errors: [error.message], config };
    }
  }
  const schemaResult = validateWizardConfigSchema(config);
  if (!schemaResult.valid) {
    return { valid: false, errors: schemaResult.errors, config };
  }
  return { valid: true, errors: [], config };
}

/**
 * Perform additional semantic validations
 * @function performSemanticValidations
 * @param {Object} config - Configuration object
 * @param {string} configPath - Path to config file
 * @param {boolean} validateFilePaths - Whether to validate file paths
 * @returns {Promise<Object>} Validation result with errors array
 */
async function performSemanticValidations(config, configPath, validateFilePaths) {
  const errors = [];
  if (validateFilePaths && config.source?.type === 'openapi-file' && config.source?.filePath) {
    const basePath = path.dirname(path.resolve(configPath));
    const fileResult = await validateFilePath(config.source.filePath, basePath);
    if (!fileResult.valid) {
      errors.push(...fileResult.errors);
    }
  }
  if (config.mode === 'add-datasource' && !config.systemIdOrKey) {
    errors.push('\'systemIdOrKey\' is required when mode is \'add-datasource\'');
  }
  return errors;
}

/**
 * Validate wizard configuration with all checks
 * @async
 * @function validateWizardConfig
 * @param {string} configPath - Path to wizard.yaml file
 * @param {Object} [options] - Validation options
 * @param {boolean} [options.resolveEnvVars=true] - Whether to resolve env vars
 * @param {boolean} [options.validateFilePaths=true] - Whether to validate file paths
 * @returns {Promise<Object>} Validation result with valid flag, errors, and config
 */
async function validateWizardConfig(configPath, options = {}) {
  const { resolveEnvVars: shouldResolveEnvVars = true, validateFilePaths = true } = options;
  let config;
  try {
    config = await loadWizardConfig(configPath);
  } catch (error) {
    return { valid: false, errors: [error.message], config: null };
  }
  const schemaResult = validateSchemaAndResolveEnvVars(config, shouldResolveEnvVars);
  if (!schemaResult.valid) {
    return schemaResult;
  }
  config = schemaResult.config;
  const errors = await performSemanticValidations(config, configPath, validateFilePaths);
  return { valid: errors.length === 0, errors, config };
}

/**
 * Display validation results to console
 * @function displayValidationResults
 * @param {Object} result - Validation result
 * @param {boolean} result.valid - Whether validation passed
 * @param {string[]} result.errors - Array of error messages
 */
function displayValidationResults(result) {
  const chalk = require('chalk');
  if (result.valid) {
    // eslint-disable-next-line no-console
    console.log(chalk.green('Wizard configuration is valid'));
  } else {
    // eslint-disable-next-line no-console
    console.log(chalk.red('✗ Wizard configuration validation failed:'));
    result.errors.forEach(error => {
      // eslint-disable-next-line no-console
      console.log(chalk.red(`  - ${error}`));
    });
  }
}

module.exports = {
  loadWizardConfig,
  writeWizardConfig,
  wizardConfigExists,
  validateWizardConfig,
  validateWizardConfigSchema,
  resolveEnvVar,
  resolveEnvVarsInObject,
  formatValidationErrors,
  displayValidationResults
};
