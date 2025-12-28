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
const { resolveExternalFiles } = require('./utils/schema-resolver');
const { loadExternalSystemSchema, loadExternalDataSourceSchema, detectSchemaType } = require('./utils/schema-loader');
const { formatValidationErrors } = require('./utils/error-formatter');
const { detectAppType } = require('./utils/paths');
const logger = require('./utils/logger');

/**
 * Validates a single external file against its schema
 *
 * @async
 * @function validateExternalFile
 * @param {string} filePath - Path to the file
 * @param {string} type - File type: 'system' | 'datasource'
 * @returns {Promise<Object>} Validation result
 */
async function validateExternalFile(filePath, type) {
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

  let validate;
  if (type === 'system') {
    validate = loadExternalSystemSchema();
  } else if (type === 'datasource') {
    validate = loadExternalDataSourceSchema();
  } else {
    throw new Error(`Unknown file type: ${type}`);
  }

  const valid = validate(parsed);

  const errors = valid ? [] : formatValidationErrors(validate.errors);
  const warnings = [];

  // Additional validation for external system files: check role references in permissions
  if (type === 'system' && parsed.permissions && Array.isArray(parsed.permissions)) {
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

  return {
    valid: errors.length === 0,
    errors,
    warnings
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
async function validateAppOrFile(appOrFile) {
  if (!appOrFile || typeof appOrFile !== 'string') {
    throw new Error('App name or file path is required');
  }

  // Check if it's a file path (exists and is a file)
  const isFilePath = fs.existsSync(appOrFile) && fs.statSync(appOrFile).isFile();

  if (isFilePath) {
    // Validate single file
    const schemaType = detectSchemaType(appOrFile);
    let result;

    if (schemaType === 'application') {
      // For application files, we'd need to transform them first
      // For now, just validate JSON structure
      const content = fs.readFileSync(appOrFile, 'utf8');
      try {
        JSON.parse(content);
      } catch (error) {
        return {
          valid: false,
          errors: [`Invalid JSON syntax: ${error.message}`],
          warnings: []
        };
      }
      // Note: Full application validation requires variables.yaml transformation
      // This is a simplified validation for direct JSON files
      result = {
        valid: true,
        errors: [],
        warnings: ['Application file validation is simplified. Use app name for full validation.']
      };
    } else if (schemaType === 'external-system') {
      result = await validateExternalFile(appOrFile, 'system');
    } else if (schemaType === 'external-datasource') {
      result = await validateExternalFile(appOrFile, 'datasource');
    } else {
      throw new Error(`Unknown schema type: ${schemaType}`);
    }

    return {
      valid: result.valid,
      file: appOrFile,
      type: schemaType,
      errors: result.errors,
      warnings: result.warnings
    };
  }

  // Treat as app name
  const appName = appOrFile;

  // Detect app type to support both builder/ and integration/ directories
  const { appPath, isExternal } = await detectAppType(appName);

  // Validate application
  const appValidation = await validator.validateApplication(appName);

  // Validate rbac.yaml for external systems
  let rbacValidation = null;
  if (isExternal) {
    try {
      rbacValidation = await validator.validateRbac(appName);
    } catch (error) {
      rbacValidation = {
        valid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }

  // Check for externalIntegration block
  const variablesPath = path.join(appPath, 'variables.yaml');
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

  // If no externalIntegration block, return app validation only
  if (!variables.externalIntegration) {
    return {
      valid: appValidation.valid,
      application: appValidation,
      externalFiles: []
    };
  }

  // Resolve and validate external files
  const externalFiles = await resolveExternalFiles(appName);
  const externalValidations = [];

  for (const fileInfo of externalFiles) {
    try {
      const validation = await validateExternalFile(fileInfo.path, fileInfo.type);
      externalValidations.push({
        file: fileInfo.fileName,
        path: fileInfo.path,
        type: fileInfo.type,
        ...validation
      });
    } catch (error) {
      externalValidations.push({
        file: fileInfo.fileName,
        path: fileInfo.path,
        type: fileInfo.type,
        valid: false,
        errors: [error.message],
        warnings: []
      });
    }
  }

  // Aggregate results
  const rbacErrors = rbacValidation ? rbacValidation.errors : [];
  const rbacWarnings = rbacValidation ? rbacValidation.warnings : [];
  const allValid = appValidation.valid && externalValidations.every(v => v.valid) && (!rbacValidation || rbacValidation.valid);
  const allErrors = [
    ...appValidation.errors,
    ...externalValidations.flatMap(v => v.errors.map(e => `${v.file}: ${e}`)),
    ...rbacErrors.map(e => `rbac.yaml: ${e}`)
  ];
  const allWarnings = [
    ...appValidation.warnings,
    ...externalValidations.flatMap(v => v.warnings),
    ...rbacWarnings
  ];

  return {
    valid: allValid,
    application: appValidation,
    externalFiles: externalValidations,
    rbac: rbacValidation,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Displays validation results in a user-friendly format
 *
 * @function displayValidationResults
 * @param {Object} result - Validation result from validateAppOrFile
 */
function displayValidationResults(result) {
  if (result.valid) {
    logger.log(chalk.green('\n✓ Validation passed!'));
  } else {
    logger.log(chalk.red('\n✗ Validation failed!'));
  }

  // Display application validation
  if (result.application) {
    logger.log(chalk.blue('\nApplication:'));
    if (result.application.valid) {
      logger.log(chalk.green('  ✓ Application configuration is valid'));
    } else {
      logger.log(chalk.red('  ✗ Application configuration has errors:'));
      result.application.errors.forEach(error => {
        logger.log(chalk.red(`    • ${error}`));
      });
    }
    if (result.application.warnings && result.application.warnings.length > 0) {
      result.application.warnings.forEach(warning => {
        logger.log(chalk.yellow(`    ⚠ ${warning}`));
      });
    }
  }

  // Display external files validation
  if (result.externalFiles && result.externalFiles.length > 0) {
    logger.log(chalk.blue('\nExternal Integration Files:'));
    result.externalFiles.forEach(file => {
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

  // Display rbac validation (for external systems)
  if (result.rbac) {
    logger.log(chalk.blue('\nRBAC Configuration:'));
    if (result.rbac.valid) {
      logger.log(chalk.green('  ✓ RBAC configuration is valid'));
    } else {
      logger.log(chalk.red('  ✗ RBAC configuration has errors:'));
      result.rbac.errors.forEach(error => {
        logger.log(chalk.red(`    • ${error}`));
      });
    }
    if (result.rbac.warnings && result.rbac.warnings.length > 0) {
      result.rbac.warnings.forEach(warning => {
        logger.log(chalk.yellow(`    ⚠ ${warning}`));
      });
    }
  }

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

