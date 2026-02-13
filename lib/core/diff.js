/**
 * File Comparison Utilities
 *
 * Compares two configuration files and identifies differences.
 * Used for deployment pipeline validation and schema migration detection.
 *
 * @fileoverview File comparison utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { loadConfigFile } = require('../utils/config-format');
const { detectSchemaTypeFromParsed, loadExternalSystemSchema, loadExternalDataSourceSchema } = require('../utils/schema-loader');
const { validateObjectAgainstApplicationSchema } = require('../validation/validator');
const { formatValidationErrors } = require('../utils/error-formatter');

/**
 * Handle added field in comparison
 * @param {string} key - Field key
 * @param {*} value - Field value
 * @param {string} path - Field path
 * @param {Object} result - Result object to update
 */
function handleAddedField(key, value, path, result) {
  result.added.push({
    path: path,
    value: value,
    type: typeof value
  });
  result.identical = false;
}

/**
 * Handle removed field in comparison
 * @param {string} key - Field key
 * @param {*} value - Field value
 * @param {string} path - Field path
 * @param {Object} result - Result object to update
 */
function handleRemovedField(key, value, path, result) {
  result.removed.push({
    path: path,
    value: value,
    type: typeof value
  });
  result.identical = false;
}

/**
 * Handle changed field in comparison
 * @param {*} oldValue - Old value
 * @param {*} newValue - New value
 * @param {string} path - Field path
 * @param {Object} result - Result object to update
 */
function handleChangedField(oldValue, newValue, path, result) {
  result.changed.push({
    path: path,
    oldValue: oldValue,
    newValue: newValue,
    oldType: typeof oldValue,
    newType: typeof newValue
  });
  result.identical = false;
}

/**
 * Check if value is a nested object (not array, not null)
 * @param {*} value - Value to check
 * @returns {boolean} True if nested object
 */
function isNestedObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Performs deep comparison of two objects
 * Returns differences as structured result
 *
 * @function compareObjects
 * @param {Object} obj1 - First object
 * @param {Object} obj2 - Second object
 * @param {string} [path=''] - Current path in object (for nested fields)
 * @returns {Object} Comparison result with added, removed, changed fields
 */
/**
 * Compares a single key between two objects
 * @function compareSingleKey
 * @param {string} key - Key to compare
 * @param {Object} obj1 - First object
 * @param {Object} obj2 - Second object
 * @param {string} newPath - Current path in object
 * @param {Object} result - Comparison result object
 */
function compareSingleKey(key, obj1, obj2, newPath, result) {
  const val1 = obj1 && obj1[key];
  const val2 = obj2 && obj2[key];

  if (!(key in obj1)) {
    handleAddedField(key, val2, newPath, result);
  } else if (!(key in obj2)) {
    handleRemovedField(key, val1, newPath, result);
  } else if (isNestedObject(val1) && isNestedObject(val2)) {
    // Recursively compare nested objects
    const nestedResult = compareObjects(val1, val2, newPath);
    result.added.push(...nestedResult.added);
    result.removed.push(...nestedResult.removed);
    result.changed.push(...nestedResult.changed);
    if (!nestedResult.identical) {
      result.identical = false;
    }
  } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
    handleChangedField(val1, val2, newPath, result);
  }
}

function compareObjects(obj1, obj2, currentPath = '') {
  const result = {
    added: [],
    removed: [],
    changed: [],
    identical: true
  };

  const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

  for (const key of allKeys) {
    const newPath = currentPath ? `${currentPath}.${key}` : key;
    compareSingleKey(key, obj1, obj2, newPath, result);
  }

  return result;
}

/**
 * Identifies breaking changes in comparison result
 * Breaking changes include: removed required fields, type changes
 *
 * @function identifyBreakingChanges
 * @param {Object} comparison - Comparison result from compareObjects
 * @param {Object} schema1 - First file schema (optional, for required fields check)
 * @param {Object} schema2 - Second file schema (optional, for required fields check)
 * @returns {Array} Array of breaking change descriptions
 */
function identifyBreakingChanges(comparison) {
  const breaking = [];

  // Removed fields are potentially breaking
  comparison.removed.forEach(removed => {
    breaking.push({
      type: 'removed_field',
      path: removed.path,
      description: `Field removed: ${removed.path} (${removed.type})`
    });
  });

  // Type changes are breaking
  comparison.changed.forEach(change => {
    if (change.oldType !== change.newType) {
      breaking.push({
        type: 'type_change',
        path: change.path,
        description: `Type changed: ${change.path} (${change.oldType} → ${change.newType})`
      });
    }
  });

  return breaking;
}

/**
 * Compares two configuration files.
 * Both files must be the same config type (app, system, or datasource).
 * By default validates both against their schema; pass { validate: false } to skip.
 *
 * @async
 * @function compareFiles
 * @param {string} file1 - Path to first file
 * @param {string} file2 - Path to second file
 * @param {Object} [options] - Options
 * @param {boolean} [options.validate=true] - If true, validate both files against their schema
 * @returns {Promise<Object>} Comparison result with differences
 * @throws {Error} If files cannot be read, parsed, types differ, or validation fails
 *
 * @example
 * const result = await compareFiles('./old.json', './new.json');
 * const resultNoValidate = await compareFiles('./a.yaml', './b.yaml', { validate: false });
 */
/**
 * Validates file paths
 * @function validateFilePaths
 * @param {string} file1 - First file path
 * @param {string} file2 - Second file path
 * @throws {Error} If paths are invalid
 */
function validateFilePaths(file1, file2) {
  if (!file1 || typeof file1 !== 'string') {
    throw new Error('First file path is required');
  }
  if (!file2 || typeof file2 !== 'string') {
    throw new Error('Second file path is required');
  }
  if (!fs.existsSync(file1)) {
    throw new Error(`File not found: ${file1}`);
  }
  if (!fs.existsSync(file2)) {
    throw new Error(`File not found: ${file2}`);
  }
}

/**
 * Reads and parses a config file (JSON or YAML by extension: .json, .yaml, .yml).
 * @function readAndParseFile
 * @param {string} filePath - File path
 * @returns {Object} Parsed object
 * @throws {Error} If file cannot be read or parsed
 */
function readAndParseFile(filePath) {
  try {
    return loadConfigFile(filePath);
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error.message}`);
  }
}

/**
 * Maps schema type to user-facing label (app | system | datasource).
 * @param {string} schemaType - 'application' | 'external-system' | 'external-datasource'
 * @returns {string} 'app' | 'system' | 'datasource'
 */
function toUserFacingType(schemaType) {
  const map = {
    application: 'app',
    'external-system': 'system',
    'external-datasource': 'datasource'
  };
  return map[schemaType] || 'app';
}

/**
 * Runs external schema validator and returns error messages or null.
 * @param {Function} validateFn - AJV validate function
 * @param {Object} parsed - Parsed config object
 * @returns {string[]|null} Error messages or null if valid
 */
function getValidationErrors(validateFn, parsed) {
  const valid = validateFn(parsed);
  if (valid) return null;
  return formatValidationErrors(validateFn.errors);
}

/**
 * Validates parsed object against the schema for the given type.
 * @param {Object} parsed - Parsed config object
 * @param {string} schemaType - 'application' | 'external-system' | 'external-datasource'
 * @param {string} filePath - File path (for error messages)
 * @throws {Error} If validation fails
 */
function validateParsedForType(parsed, schemaType, filePath) {
  let messages = [];
  if (schemaType === 'application') {
    const result = validateObjectAgainstApplicationSchema(parsed);
    if (!result.valid) messages = result.errors;
  } else if (schemaType === 'external-system') {
    messages = getValidationErrors(loadExternalSystemSchema(), parsed) || [];
  } else if (schemaType === 'external-datasource') {
    messages = getValidationErrors(loadExternalDataSourceSchema(), parsed) || [];
  } else {
    throw new Error(`Unknown schema type: ${schemaType}`);
  }
  if (messages.length > 0) {
    throw new Error(`Validation failed for ${filePath}: ${messages.join('; ')}`);
  }
}

/**
 * Extracts version from parsed object
 * @function extractVersion
 * @param {Object} parsed - Parsed JSON object
 * @returns {string} Version string
 */
function extractVersion(parsed) {
  return parsed.version || parsed.metadata?.version || 'unknown';
}

/**
 * Builds comparison result object
 * @function buildComparisonResult
 * @param {Object} comparison - Comparison result from compareObjects
 * @param {Object} parsed1 - First parsed object
 * @param {Object} parsed2 - Second parsed object
 * @param {string} file1 - First file path
 * @param {string} file2 - Second file path
 * @returns {Object} Complete comparison result
 */
function buildComparisonResult(comparison, parsed1, parsed2, file1, file2) {
  const version1 = extractVersion(parsed1);
  const version2 = extractVersion(parsed2);
  const versionChanged = version1 !== version2;
  const breakingChanges = identifyBreakingChanges(comparison);

  return {
    identical: comparison.identical && !versionChanged,
    file1: path.basename(file1),
    file2: path.basename(file2),
    version1,
    version2,
    versionChanged,
    added: comparison.added,
    removed: comparison.removed,
    changed: comparison.changed,
    breakingChanges,
    summary: {
      totalAdded: comparison.added.length,
      totalRemoved: comparison.removed.length,
      totalChanged: comparison.changed.length,
      totalBreaking: breakingChanges.length
    }
  };
}

async function compareFiles(file1, file2, options = {}) {
  const shouldValidate = options.validate !== false;

  validateFilePaths(file1, file2);

  const parsed1 = readAndParseFile(file1);
  const parsed2 = readAndParseFile(file2);

  const type1 = detectSchemaTypeFromParsed(parsed1, file1);
  const type2 = detectSchemaTypeFromParsed(parsed2, file2);
  const userType1 = toUserFacingType(type1);
  const userType2 = toUserFacingType(type2);

  if (userType1 !== userType2) {
    throw new Error(
      `Type mismatch: ${file1} is ${userType1} config and ${file2} is ${userType2} config. ` +
      'Both files must be the same type (app, system, or datasource).'
    );
  }

  if (shouldValidate) {
    validateParsedForType(parsed1, type1, file1);
    validateParsedForType(parsed2, type2, file2);
  }

  const comparison = compareObjects(parsed1, parsed2);
  return buildComparisonResult(comparison, parsed1, parsed2, file1, file2);
}

/**
 * Formats and displays diff output
 * Shows differences in a user-friendly format with color coding
 *
 * @function formatDiffOutput
 * @param {Object} diffResult - Comparison result from compareFiles
 */
/**
 * Displays version information if changed
 * @function displayVersionInfo
 * @param {Object} diffResult - Comparison result
 */
function displayVersionInfo(diffResult) {
  if (diffResult.versionChanged) {
    logger.log(chalk.blue(`\nVersion: ${diffResult.version1} → ${diffResult.version2}`));
  }
}

/**
 * Displays breaking changes
 * @function displayBreakingChanges
 * @param {Object[]} breakingChanges - Array of breaking changes
 */
function displayBreakingChanges(breakingChanges) {
  if (breakingChanges.length > 0) {
    logger.log(chalk.red('\n⚠️  Breaking Changes:'));
    breakingChanges.forEach(change => {
      logger.log(chalk.red(`  • ${change.description}`));
    });
  }
}

/**
 * Displays added fields
 * @function displayAddedFields
 * @param {Object[]} added - Array of added fields
 */
function displayAddedFields(added) {
  if (added.length > 0) {
    logger.log(chalk.green('\nAdded Fields:'));
    added.forEach(field => {
      logger.log(chalk.green(`  + ${field.path}: ${JSON.stringify(field.value)}`));
    });
  }
}

/**
 * Displays removed fields
 * @function displayRemovedFields
 * @param {Object[]} removed - Array of removed fields
 */
function displayRemovedFields(removed) {
  if (removed.length > 0) {
    logger.log(chalk.red('\nRemoved Fields:'));
    removed.forEach(field => {
      logger.log(chalk.red(`  - ${field.path}: ${JSON.stringify(field.value)}`));
    });
  }
}

/**
 * Displays changed fields
 * @function displayChangedFields
 * @param {Object[]} changed - Array of changed fields
 */
function displayChangedFields(changed) {
  if (changed.length > 0) {
    logger.log(chalk.yellow('\nChanged Fields:'));
    changed.forEach(change => {
      logger.log(chalk.yellow(`  ~ ${change.path}:`));
      logger.log(chalk.gray(`    Old: ${JSON.stringify(change.oldValue)}`));
      logger.log(chalk.gray(`    New: ${JSON.stringify(change.newValue)}`));
    });
  }
}

/**
 * Displays summary statistics
 * @function displaySummary
 * @param {Object} summary - Summary object
 */
function displaySummary(summary) {
  logger.log(chalk.blue('\nSummary:'));
  logger.log(chalk.blue(`  Added: ${summary.totalAdded}`));
  logger.log(chalk.blue(`  Removed: ${summary.totalRemoved}`));
  logger.log(chalk.blue(`  Changed: ${summary.totalChanged}`));
  logger.log(chalk.blue(`  Breaking: ${summary.totalBreaking}`));
}

function formatDiffOutput(diffResult) {
  logger.log(chalk.blue(`\nComparing: ${diffResult.file1} ↔ ${diffResult.file2}`));

  if (diffResult.identical) {
    logger.log(chalk.green('\n✓ Files are identical'));
    return;
  }

  logger.log(chalk.yellow('\nFiles are different'));

  displayVersionInfo(diffResult);
  displayBreakingChanges(diffResult.breakingChanges);
  displayAddedFields(diffResult.added);
  displayRemovedFields(diffResult.removed);
  displayChangedFields(diffResult.changed);
  displaySummary(diffResult.summary);
}

module.exports = {
  compareFiles,
  formatDiffOutput,
  compareObjects,
  identifyBreakingChanges
};

