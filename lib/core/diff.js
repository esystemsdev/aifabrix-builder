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
 * Compares two configuration files
 * Loads files, parses JSON, and performs deep comparison
 *
 * @async
 * @function compareFiles
 * @param {string} file1 - Path to first file
 * @param {string} file2 - Path to second file
 * @returns {Promise<Object>} Comparison result with differences
 * @throws {Error} If files cannot be read or parsed
 *
 * @example
 * const result = await compareFiles('./old.json', './new.json');
 * // Returns: { identical: false, added: [...], removed: [...], changed: [...] }
 */
async function compareFiles(file1, file2) {
  if (!file1 || typeof file1 !== 'string') {
    throw new Error('First file path is required');
  }
  if (!file2 || typeof file2 !== 'string') {
    throw new Error('Second file path is required');
  }

  // Validate files exist
  if (!fs.existsSync(file1)) {
    throw new Error(`File not found: ${file1}`);
  }
  if (!fs.existsSync(file2)) {
    throw new Error(`File not found: ${file2}`);
  }

  // Read and parse files
  let content1, content2;
  let parsed1, parsed2;

  try {
    content1 = fs.readFileSync(file1, 'utf8');
    parsed1 = JSON.parse(content1);
  } catch (error) {
    throw new Error(`Failed to parse ${file1}: ${error.message}`);
  }

  try {
    content2 = fs.readFileSync(file2, 'utf8');
    parsed2 = JSON.parse(content2);
  } catch (error) {
    throw new Error(`Failed to parse ${file2}: ${error.message}`);
  }

  // Compare objects
  const comparison = compareObjects(parsed1, parsed2);

  // Check for version changes
  const version1 = parsed1.version || parsed1.metadata?.version || 'unknown';
  const version2 = parsed2.version || parsed2.metadata?.version || 'unknown';
  const versionChanged = version1 !== version2;

  // Identify breaking changes
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

/**
 * Formats and displays diff output
 * Shows differences in a user-friendly format with color coding
 *
 * @function formatDiffOutput
 * @param {Object} diffResult - Comparison result from compareFiles
 */
function formatDiffOutput(diffResult) {
  logger.log(chalk.blue(`\nComparing: ${diffResult.file1} ↔ ${diffResult.file2}`));

  if (diffResult.identical) {
    logger.log(chalk.green('\n✓ Files are identical'));
    return;
  }

  logger.log(chalk.yellow('\nFiles are different'));

  // Version information
  if (diffResult.versionChanged) {
    logger.log(chalk.blue(`\nVersion: ${diffResult.version1} → ${diffResult.version2}`));
  }

  // Breaking changes
  if (diffResult.breakingChanges.length > 0) {
    logger.log(chalk.red('\n⚠️  Breaking Changes:'));
    diffResult.breakingChanges.forEach(change => {
      logger.log(chalk.red(`  • ${change.description}`));
    });
  }

  // Added fields
  if (diffResult.added.length > 0) {
    logger.log(chalk.green('\nAdded Fields:'));
    diffResult.added.forEach(field => {
      logger.log(chalk.green(`  + ${field.path}: ${JSON.stringify(field.value)}`));
    });
  }

  // Removed fields
  if (diffResult.removed.length > 0) {
    logger.log(chalk.red('\nRemoved Fields:'));
    diffResult.removed.forEach(field => {
      logger.log(chalk.red(`  - ${field.path}: ${JSON.stringify(field.value)}`));
    });
  }

  // Changed fields
  if (diffResult.changed.length > 0) {
    logger.log(chalk.yellow('\nChanged Fields:'));
    diffResult.changed.forEach(change => {
      logger.log(chalk.yellow(`  ~ ${change.path}:`));
      logger.log(chalk.gray(`    Old: ${JSON.stringify(change.oldValue)}`));
      logger.log(chalk.gray(`    New: ${JSON.stringify(change.newValue)}`));
    });
  }

  // Summary
  logger.log(chalk.blue('\nSummary:'));
  logger.log(chalk.blue(`  Added: ${diffResult.summary.totalAdded}`));
  logger.log(chalk.blue(`  Removed: ${diffResult.summary.totalRemoved}`));
  logger.log(chalk.blue(`  Changed: ${diffResult.summary.totalChanged}`));
  logger.log(chalk.blue(`  Breaking: ${diffResult.summary.totalBreaking}`));
}

module.exports = {
  compareFiles,
  formatDiffOutput,
  compareObjects,
  identifyBreakingChanges
};

