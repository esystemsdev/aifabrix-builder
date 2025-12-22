/**
 * Permission Error Formatters
 *
 * Formats permission-related errors (403) with missing and required permissions
 *
 * @fileoverview Permission error formatting utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const chalk = require('chalk');

/**
 * Extracts missing permissions from error data
 * @param {Object} errorData - Error response data
 * @returns {Array<string>} Array of missing permissions
 */
function extractMissingPermissions(errorData) {
  if (errorData.missingPermissions && Array.isArray(errorData.missingPermissions)) {
    return errorData.missingPermissions;
  }
  if (errorData.missing && errorData.missing.permissions && Array.isArray(errorData.missing.permissions)) {
    return errorData.missing.permissions;
  }
  return [];
}

/**
 * Extracts required permissions from error data
 * @param {Object} errorData - Error response data
 * @returns {Array<string>} Array of required permissions
 */
function extractRequiredPermissions(errorData) {
  if (errorData.requiredPermissions && Array.isArray(errorData.requiredPermissions)) {
    return errorData.requiredPermissions;
  }
  if (errorData.required && errorData.required.permissions && Array.isArray(errorData.required.permissions)) {
    return errorData.required.permissions;
  }
  return [];
}

/**
 * Adds permission list to lines array
 * @param {Array<string>} lines - Lines array to append to
 * @param {Array<string>} perms - Permissions array
 * @param {string} label - Label for the permissions list
 */
function addPermissionList(lines, perms, label) {
  if (perms.length > 0) {
    lines.push(chalk.yellow(`${label}:`));
    perms.forEach(perm => {
      lines.push(chalk.gray(`  - ${perm}`));
    });
    lines.push('');
  }
}

/**
 * Formats permission error with missing and required permissions
 * @param {Object} errorData - Error response data
 * @returns {string} Formatted permission error message
 */
function formatPermissionError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Permission Denied\n'));

  if (errorData.detail) {
    lines.push(chalk.yellow(errorData.detail));
    lines.push('');
  }

  const missingPerms = extractMissingPermissions(errorData);
  addPermissionList(lines, missingPerms, 'Missing permissions');

  const requiredPerms = extractRequiredPermissions(errorData);
  addPermissionList(lines, requiredPerms, 'Required permissions');

  const requestUrl = errorData.instance || errorData.url;
  const method = errorData.method || 'POST';
  if (requestUrl) {
    lines.push(chalk.gray(`Request: ${method} ${requestUrl}`));
  }
  if (errorData.correlationId) {
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

module.exports = {
  formatPermissionError
};

