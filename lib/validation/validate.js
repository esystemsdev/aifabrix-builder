/**
 * Main Validation Command
 *
 * Validates applications or external integration files.
 * Supports app name validation (including externalIntegration block) or direct file validation.
 *
 * @fileoverview Main validation command for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const yaml = require('js-yaml');
const validator = require('./validator');
const { resolveExternalFiles } = require('../utils/schema-resolver');
const { loadExternalSystemSchema, loadExternalDataSourceSchema, detectSchemaType } = require('../utils/schema-loader');
const { formatValidationErrors } = require('../utils/error-formatter');
const { detectAppType } = require('../utils/paths');
const { logOfflinePathWhenType } = require('../utils/cli-utils');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { displayValidationResults } = require('./validate-display');
const { generateControllerManifest } = require('../generator/external-controller-manifest');
const { validateControllerManifest } = require('./external-manifest-validator');

/**
 * Validates a file path (detects type and validates)
 * @async
 * @param {string} filePath - Path to file
 * @returns {Promise<Object>} Validation result
 */
async function validateFilePath(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const type = detectSchemaType(filePath, content);

  return await validateExternalFile(filePath, type);
}

/**
 * Validates external files for an application
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<Array>} Array of validation results
 */
async function validateExternalFilesForApp(appName, options = {}) {
  const files = await resolveExternalFiles(appName, options);
  const validations = [];

  for (const file of files) {
    const result = await validateExternalFile(file.path, file.type);
    validations.push({
      ...result,
      file: file.fileName,
      path: file.path,
      type: file.type
    });
  }

  return validations;
}

/**
 * Aggregates validation results from multiple sources
 * @param {Object} appValidation - Application validation result
 * @param {Array} externalValidations - External file validation results
 * @param {Object|null} rbacValidation - RBAC validation result (optional)
 * @returns {Object} Aggregated validation result
 */
function aggregateValidationResults(appValidation, externalValidations, rbacValidation) {
  const allErrors = [...(appValidation.errors || [])];
  const allWarnings = [...(appValidation.warnings || [])];

  if (rbacValidation && !rbacValidation.valid) {
    allErrors.push(...(rbacValidation.errors || []));
    allWarnings.push(...(rbacValidation.warnings || []));
  }

  externalValidations.forEach(validation => {
    if (!validation.valid) {
      allErrors.push(`External ${validation.type} file "${validation.file}": ${validation.errors.join(', ')}`);
    }
    if (validation.warnings && validation.warnings.length > 0) {
      allWarnings.push(`External ${validation.type} file "${validation.file}": ${validation.warnings.join(', ')}`);
    }
  });

  return {
    valid: appValidation.valid && (!rbacValidation || rbacValidation.valid) && externalValidations.every(v => v.valid),
    application: appValidation,
    externalFiles: externalValidations,
    rbac: rbacValidation,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Validates a single external file against its schema
 *
 * @async
 * @function validateExternalFile
 * @param {string} filePath - Path to the file
 * @param {string} type - File type: 'system' | 'datasource'
 * @returns {Promise<Object>} Validation result
 */
/**
 * Parses external system/datasource file content (JSON or YAML).
 * @function parseJsonFileContent
 * @param {string} filePath - File path (.json, .yaml, or .yml)
 * @returns {Object} Parse result with parsed object or error
 */
function parseJsonFileContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const isYaml = /\.(yaml|yml)$/i.test(filePath);
  try {
    const parsed = isYaml ? yaml.load(content) : JSON.parse(content);
    return { parsed: parsed || {}, error: null };
  } catch (error) {
    return {
      parsed: null,
      error: {
        valid: false,
        errors: [isYaml ? `Invalid YAML syntax: ${error.message}` : `Invalid JSON syntax: ${error.message}`],
        warnings: []
      }
    };
  }
}

/**
 * Gets validator function for file type
 * @function getValidatorForType
 * @param {string} normalizedType - Normalized file type
 * @returns {Function} Validator function
 * @throws {Error} If type is unknown
 */
function getValidatorForType(normalizedType) {
  if (normalizedType === 'system') {
    return loadExternalSystemSchema();
  }
  if (normalizedType === 'datasource') {
    return loadExternalDataSourceSchema();
  }
  throw new Error(`Unknown file type: ${normalizedType}`);
}

/**
 * Validates role references in permissions
 * @function validateRoleReferences
 * @param {Object} parsed - Parsed JSON object
 * @param {string[]} errors - Errors array to append to
 */
function validateRoleReferences(parsed, errors) {
  if (!parsed.permissions || !Array.isArray(parsed.permissions)) {
    return;
  }

  const roles = parsed.roles || [];
  const roleValues = new Set(roles.map(r => r.value));

  parsed.permissions.forEach((permission, index) => {
    if (permission.roles && Array.isArray(permission.roles)) {
      permission.roles.forEach(roleValue => {
        if (!roleValues.has(roleValue)) {
          errors.push(`Permission "${permission.name}" (index ${index}) references role "${roleValue}" which does not exist in roles array`);
        }
      });
    }
  });
}

async function validateExternalFile(filePath, type) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const parseResult = parseJsonFileContent(filePath);
  if (parseResult.error) {
    return parseResult.error;
  }

  const normalizedType = type === 'external-system' ? 'system' : (type === 'external-datasource' ? 'datasource' : type);
  const validate = getValidatorForType(normalizedType);
  const valid = validate(parseResult.parsed);

  const errors = valid ? [] : formatValidationErrors(validate.errors);
  const warnings = [];

  if (normalizedType === 'system') {
    validateRoleReferences(parseResult.parsed, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    file: filePath,
    type: type
  };
}

/**
 * Validates application or external integration file
 * Detects if input is app name or file path and validates accordingly
 *
 * @async
 * @function validateAppOrFile
 * @param {string} appOrFile - Application name or file path
 * @param {Object} [options] - Validation options
 *
 * @returns {Promise<Object>} Validation result with aggregated results
 * @throws {Error} If validation fails
 *
 * @example
 * const result = await validateAppOrFile('myapp');
 * // Returns: { valid: true, application: {...}, externalFiles: [...] }
 */
/**
 * Validates RBAC for external systems
 * @async
 * @function validateRbacForExternalSystem
 * @param {boolean} isExternal - Whether app is external system
 * @param {string} appName - Application name
 * @returns {Promise<Object|null>} RBAC validation result or null
 */
async function validateRbacForExternalSystem(isExternal, appName) {
  if (!isExternal) {
    return null;
  }

  try {
    return await validator.validateRbac(appName);
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
      warnings: []
    };
  }
}

/**
 * Loads and checks application config for externalIntegration
 * @function loadVariablesAndCheckExternalIntegration
 * @param {string} variablesPath - Path to application config
 * @param {Object} appValidation - Application validation result
 * @returns {Object|null} Variables object or null if no externalIntegration
 */
function loadVariablesAndCheckExternalIntegration(variablesPath, appValidation) {
  if (!fs.existsSync(variablesPath)) {
    return {
      valid: appValidation.valid,
      application: appValidation,
      externalFiles: []
    };
  }

  const yamlLib = require('js-yaml');
  const content = fs.readFileSync(variablesPath, 'utf8');
  let variables;

  try {
    variables = yamlLib.load(content);
  } catch (error) {
    return {
      valid: appValidation.valid,
      application: appValidation,
      externalFiles: [],
      warnings: [`Could not parse application config to check externalIntegration: ${error.message}`]
    };
  }

  if (!variables.externalIntegration) {
    return {
      valid: appValidation.valid,
      application: appValidation,
      externalFiles: []
    };
  }

  return null;
}

/**
 * Validates application configuration step
 * @async
 * @function validateApplicationStep
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Application validation result
 */
async function validateApplicationStep(appName, options = {}) {
  try {
    const appValidation = await validator.validateApplication(appName, options);
    return {
      valid: appValidation.valid,
      errors: appValidation.errors || [],
      warnings: appValidation.warnings || []
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
      warnings: []
    };
  }
}

/**
 * Validates individual component files step
 * @async
 * @function validateComponentsStep
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Components validation result
 */
async function validateComponentsStep(appName, options = {}) {
  try {
    const externalValidations = await validateExternalFilesForApp(appName, options);
    const componentErrors = [];
    const componentWarnings = [];
    const componentFiles = [];

    externalValidations.forEach(validation => {
      componentFiles.push({
        file: validation.file,
        type: validation.type,
        valid: validation.valid,
        path: validation.path
      });

      if (!validation.valid) {
        componentErrors.push(`${validation.file} (${validation.type}): ${validation.errors.join(', ')}`);
      }
      if (validation.warnings && validation.warnings.length > 0) {
        componentWarnings.push(`${validation.file}: ${validation.warnings.join(', ')}`);
      }
    });

    return {
      valid: componentErrors.length === 0,
      errors: componentErrors,
      warnings: componentWarnings,
      files: componentFiles
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.message],
      warnings: [],
      files: []
    };
  }
}

/**
 * Validates full deployment manifest step
 * @async
 * @function validateManifestStep
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Manifest validation result
 */
async function validateManifestStep(appName, options = {}) {
  try {
    const manifest = await generateControllerManifest(appName, options);
    const manifestValidation = await validateControllerManifest(manifest);
    return {
      valid: manifestValidation.valid,
      errors: manifestValidation.errors || [],
      warnings: manifestValidation.warnings || []
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Failed to validate manifest: ${error.message}`],
      warnings: []
    };
  }
}

/**
 * Validates external system completely (components + full manifest)
 * Performs step-by-step validation: application config → components → full manifest
 *
 * @async
 * @function validateExternalSystemComplete
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Complete validation result with step-by-step results
 * @throws {Error} If validation fails critically
 *
 * @example
 * const result = await validateExternalSystemComplete('my-hubspot');
 * // Returns: { valid: true, errors: [], warnings: [], steps: {...} }
 */
async function validateExternalSystemComplete(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  const steps = {
    application: { valid: false, errors: [], warnings: [] },
    components: { valid: false, errors: [], warnings: [], files: [] },
    manifest: { valid: false, errors: [], warnings: [] }
  };

  const externalOptions = { ...options };

  // Step 1: Validate Application Config
  steps.application = await validateApplicationStep(appName, externalOptions);

  // Step 2: Validate Individual Components
  steps.components = await validateComponentsStep(appName, externalOptions);

  // If components have errors, return early (don't validate manifest)
  if (!steps.components.valid) {
    return {
      valid: false,
      errors: [...steps.application.errors, ...steps.components.errors],
      warnings: [...steps.application.warnings, ...steps.components.warnings],
      steps
    };
  }

  // Step 3 & 4: Generate and Validate Full Manifest (only if Step 2 passes)
  steps.manifest = await validateManifestStep(appName, externalOptions);

  // Aggregate Results
  const allErrors = [...steps.application.errors, ...steps.components.errors, ...steps.manifest.errors];
  const allWarnings = [...steps.application.warnings, ...steps.components.warnings, ...steps.manifest.warnings];

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    steps
  };
}

async function validateAppOrFile(appOrFile, options = {}) {
  if (!appOrFile || typeof appOrFile !== 'string') {
    throw new Error('App name or file path is required');
  }

  const isFilePath = fs.existsSync(appOrFile) && fs.statSync(appOrFile).isFile();
  if (isFilePath) {
    return await validateFilePath(appOrFile);
  }

  const appName = appOrFile;
  const { appPath, isExternal } = await detectAppType(appName);
  logOfflinePathWhenType(appPath);

  if (isExternal) {
    return await validateExternalSystemComplete(appName, options);
  }

  const appValidation = await validator.validateApplication(appName, options);
  const rbacValidation = await validateRbacForExternalSystem(isExternal, appName);

  const variablesPath = resolveApplicationConfigPath(appPath);
  const earlyReturn = loadVariablesAndCheckExternalIntegration(variablesPath, appValidation);
  if (earlyReturn) {
    return earlyReturn;
  }

  const externalValidations = await validateExternalFilesForApp(appName, options);
  return aggregateValidationResults(appValidation, externalValidations, rbacValidation);
}

module.exports = {
  validateAppOrFile,
  validateExternalSystemComplete,
  displayValidationResults,
  validateExternalFile,
  validateExternalFilesForApp,
  validateFilePath
};

