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
const path = require('path');
const chalk = require('chalk');
const validator = require('./validator');
const { resolveExternalFiles } = require('../utils/schema-resolver');
const { loadExternalSystemSchema, loadExternalDataSourceSchema, detectSchemaType } = require('../utils/schema-loader');
const { formatValidationErrors } = require('../utils/error-formatter');
const { detectAppType } = require('../utils/paths');
const logger = require('../utils/logger');

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
async function validateExternalFilesForApp(appName) {
  const files = await resolveExternalFiles(appName);
  const validations = [];

  for (const file of files) {
    const result = await validateExternalFile(file.path, file.type);
    validations.push({
      file: file.fileName,
      path: file.path,
      type: file.type,
      ...result
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
 * Parses JSON file content
 * @function parseJsonFileContent
 * @param {string} filePath - File path
 * @returns {Object} Parse result with parsed object or error
 */
function parseJsonFileContent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return { parsed: JSON.parse(content), error: null };
  } catch (error) {
    return {
      parsed: null,
      error: {
        valid: false,
        errors: [`Invalid JSON syntax: ${error.message}`],
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
 * Loads and checks variables.yaml for externalIntegration
 * @function loadVariablesAndCheckExternalIntegration
 * @param {string} variablesPath - Path to variables.yaml
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
      warnings: [`Could not parse variables.yaml to check externalIntegration: ${error.message}`]
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

async function validateAppOrFile(appOrFile) {
  if (!appOrFile || typeof appOrFile !== 'string') {
    throw new Error('App name or file path is required');
  }

  const isFilePath = fs.existsSync(appOrFile) && fs.statSync(appOrFile).isFile();
  if (isFilePath) {
    return await validateFilePath(appOrFile);
  }

  const appName = appOrFile;
  const { appPath, isExternal } = await detectAppType(appName);
  const appValidation = await validator.validateApplication(appName);
  const rbacValidation = await validateRbacForExternalSystem(isExternal, appName);

  const variablesPath = path.join(appPath, 'variables.yaml');
  const earlyReturn = loadVariablesAndCheckExternalIntegration(variablesPath, appValidation);
  if (earlyReturn) {
    return earlyReturn;
  }

  const externalValidations = await validateExternalFilesForApp(appName);
  return aggregateValidationResults(appValidation, externalValidations, rbacValidation);
}

/**
 * Displays validation results in a user-friendly format
 *
 * @function displayValidationResults
 * @param {Object} result - Validation result from validateAppOrFile
 */
/**
 * Displays application validation results
 * @function displayApplicationValidation
 * @param {Object} application - Application validation result
 */
function displayApplicationValidation(application) {
  if (!application) {
    return;
  }

  logger.log(chalk.blue('\nApplication:'));
  if (application.valid) {
    logger.log(chalk.green('  ✓ Application configuration is valid'));
  } else {
    logger.log(chalk.red('  ✗ Application configuration has errors:'));
    application.errors.forEach(error => {
      logger.log(chalk.red(`    • ${error}`));
    });
  }
  if (application.warnings && application.warnings.length > 0) {
    application.warnings.forEach(warning => {
      logger.log(chalk.yellow(`    ⚠ ${warning}`));
    });
  }
}

/**
 * Displays external files validation results
 * @function displayExternalFilesValidation
 * @param {Array} externalFiles - External files validation results
 */
function displayExternalFilesValidation(externalFiles) {
  if (!externalFiles || externalFiles.length === 0) {
    return;
  }

  logger.log(chalk.blue('\nExternal Integration Files:'));
  externalFiles.forEach(file => {
    if (file.valid) {
      logger.log(chalk.green(`  ✓ ${file.file} (${file.type})`));
    } else {
      logger.log(chalk.red(`  ✗ ${file.file} (${file.type}):`));
      file.errors.forEach(error => {
        logger.log(chalk.red(`    • ${error}`));
      });
    }
    if (file.warnings && file.warnings.length > 0) {
      file.warnings.forEach(warning => {
        logger.log(chalk.yellow(`    ⚠ ${warning}`));
      });
    }
  });
}

/**
 * Displays RBAC validation results
 * @function displayRbacValidation
 * @param {Object} rbac - RBAC validation result
 */
function displayRbacValidation(rbac) {
  if (!rbac) {
    return;
  }

  logger.log(chalk.blue('\nRBAC Configuration:'));
  if (rbac.valid) {
    logger.log(chalk.green('  ✓ RBAC configuration is valid'));
  } else {
    logger.log(chalk.red('  ✗ RBAC configuration has errors:'));
    rbac.errors.forEach(error => {
      logger.log(chalk.red(`    • ${error}`));
    });
  }
  if (rbac.warnings && rbac.warnings.length > 0) {
    rbac.warnings.forEach(warning => {
      logger.log(chalk.yellow(`    ⚠ ${warning}`));
    });
  }
}

function displayValidationResults(result) {
  if (result.valid) {
    logger.log(chalk.green('\n✓ Validation passed!'));
  } else {
    logger.log(chalk.red('\n✗ Validation failed!'));
  }

  displayApplicationValidation(result.application);
  displayExternalFilesValidation(result.externalFiles);
  displayRbacValidation(result.rbac);

  // Display file validation (for direct file validation)
  if (result.file) {
    logger.log(chalk.blue(`\nFile: ${result.file}`));
    logger.log(chalk.blue(`Type: ${result.type}`));
    if (result.valid) {
      logger.log(chalk.green('  ✓ File is valid'));
    } else {
      logger.log(chalk.red('  ✗ File has errors:'));
      result.errors.forEach(error => {
        logger.log(chalk.red(`    • ${error}`));
      });
    }
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach(warning => {
        logger.log(chalk.yellow(`    ⚠ ${warning}`));
      });
    }
  }

  // Display aggregated warnings
  if (result.warnings && result.warnings.length > 0) {
    logger.log(chalk.yellow('\nWarnings:'));
    result.warnings.forEach(warning => {
      logger.log(chalk.yellow(`  • ${warning}`));
    });
  }
}

module.exports = {
  validateAppOrFile,
  displayValidationResults,
  validateExternalFile
};

