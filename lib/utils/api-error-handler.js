/**
 * AI Fabrix Builder API Error Handler
 *
 * Parses and formats structured error responses from the controller API
 * Handles permission errors, validation errors, authentication errors,
 * network errors, and server errors with user-friendly formatting
 *
 * @fileoverview API error handling utilities for AI Fabrix Builder
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
/**
 * Formats validation error with field-level details
 * Handles unified error API response format (RFC 7807 Problem Details)
 * @param {Object} errorData - Error response data
 * @returns {string} Formatted validation error message
 */
function formatValidationError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Validation Error\n'));

  // Handle RFC 7807 Problem Details format
  // Priority: detail > title > errorDescription > message > error
  if (errorData.detail) {
    lines.push(chalk.yellow(errorData.detail));
    lines.push('');
  } else if (errorData.title) {
    lines.push(chalk.yellow(errorData.title));
    lines.push('');
  } else if (errorData.errorDescription) {
    // Handle Keycloak-style error format
    lines.push(chalk.yellow(errorData.errorDescription));
    if (errorData.error) {
      lines.push(chalk.gray(`Error code: ${errorData.error}`));
    }
    lines.push('');
  } else if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
    lines.push('');
  } else if (errorData.error) {
    lines.push(chalk.yellow(errorData.error));
    lines.push('');
  }
  // Handle errors array - this is the most important part
  if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
    lines.push(chalk.yellow('Validation errors:'));
    errorData.errors.forEach(err => {
      const field = err.field || err.path || 'validation';
      const message = err.message || 'Invalid value';
      // If field is 'validation' or generic, just show the message
      if (field === 'validation' || field === 'unknown') {
        lines.push(chalk.gray(`  • ${message}`));
      } else {
        lines.push(chalk.gray(`  • ${field}: ${message}`));
      }
    });
    lines.push('');
  }
  // Show instance (endpoint) if available (RFC 7807)
  if (errorData.instance) {
    lines.push(chalk.gray(`Endpoint: ${errorData.instance}`));
  }
  // Show correlation ID if available
  if (errorData.correlationId) {
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }
  return lines.join('\n');
}
/**
 * Formats authentication error
 * @param {Object} errorData - Error response data
 * @returns {string} Formatted authentication error message
 */
function formatAuthenticationError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Authentication Failed\n'));
  if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
  } else {
    lines.push(chalk.yellow('Invalid credentials or token expired.'));
  }
  lines.push('');
  lines.push(chalk.gray('Run: aifabrix login'));
  if (errorData.correlationId) {
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }
  return lines.join('\n');
}
/**
 * Formats network error
 * @param {string} errorMessage - Error message
 * @param {Object} errorData - Error response data (optional)
 * @returns {string} Formatted network error message
 */
function formatNetworkError(errorMessage, errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Network Error\n'));

  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Cannot connect')) {
    lines.push(chalk.yellow('Cannot connect to controller.'));
    lines.push(chalk.gray('Check if the controller is running.'));
  } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('hostname not found')) {
    lines.push(chalk.yellow('Controller hostname not found.'));
    lines.push(chalk.gray('Check your controller URL.'));
  } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    lines.push(chalk.yellow('Request timed out.'));
    lines.push(chalk.gray('The controller may be overloaded.'));
  } else {
    lines.push(chalk.yellow(errorMessage));
  }

  if (errorData && errorData.correlationId) {
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

/**
 * Formats server error (500+)
 * @param {Object} errorData - Error response data
 * @returns {string} Formatted server error message
 */
function formatServerError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Server Error\n'));

  // Check for RFC 7807 Problem Details format (detail field)
  if (errorData.detail) {
    lines.push(chalk.yellow(errorData.detail));
  } else if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
  } else {
    lines.push(chalk.yellow('An internal server error occurred.'));
  }
  lines.push('');
  lines.push(chalk.gray('Please try again later or contact support.'));

  if (errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

/**
 * Formats conflict error (409)
 * @param {Object} errorData - Error response data
 * @returns {string} Formatted conflict error message
 */
function formatConflictError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Conflict\n'));

  // Check if it's an application already exists error
  const detail = errorData.detail || errorData.message || '';
  if (detail.toLowerCase().includes('application already exists')) {
    lines.push(chalk.yellow('This application already exists in this environment.'));
    lines.push('');
    lines.push(chalk.gray('Options:'));
    lines.push(chalk.gray('  • Use a different environment'));
    lines.push(chalk.gray('  • Check existing applications: aifabrix app list -e <environment>'));
    lines.push(chalk.gray('  • Update the existing application if needed'));
  } else if (detail) {
    lines.push(chalk.yellow(detail));
  } else if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
  } else {
    lines.push(chalk.yellow('A conflict occurred. The resource may already exist.'));
  }

  if (errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

/**
 * Gets actionable guidance options based on error detail
 * @param {string} detail - Error detail message
 * @returns {Array<string>} Array of guidance options
 */
function getNotFoundGuidance(detail) {
  const lowerDetail = detail.toLowerCase();
  if (lowerDetail.includes('environment')) {
    return [
      '  • Check the environment key spelling',
      '  • List available environments: aifabrix app list -e <environment>',
      '  • Verify you have access to this environment'
    ];
  }
  if (lowerDetail.includes('application')) {
    return [
      '  • Check the application key spelling',
      '  • List applications: aifabrix app list -e <environment>',
      '  • Verify the application exists in this environment'
    ];
  }
  return [
    '  • Check the resource identifier',
    '  • Verify the resource exists',
    '  • Check your permissions'
  ];
}

/**
 * Formats not found error (404)
 * @param {Object} errorData - Error response data
 * @returns {string} Formatted not found error message
 */
function formatNotFoundError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Not Found\n'));

  const detail = errorData.detail || errorData.message || '';
  if (detail) {
    lines.push(chalk.yellow(detail));
    lines.push('');
  }

  lines.push(chalk.gray('Options:'));
  const guidance = getNotFoundGuidance(detail);
  guidance.forEach(option => {
    lines.push(chalk.gray(option));
  });

  if (errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

/**
 * Formats generic error
 * @param {Object} errorData - Error response data
 * @param {number} statusCode - HTTP status code
 * @returns {string} Formatted error message
 */
function formatGenericError(errorData, statusCode) {
  const lines = [];
  lines.push(chalk.red(`❌ Error (HTTP ${statusCode})\n`));

  // Check for RFC 7807 Problem Details format (detail field)
  if (errorData.detail) {
    lines.push(chalk.yellow(errorData.detail));
  } else if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
  } else if (errorData.error) {
    lines.push(chalk.yellow(errorData.error));
  } else {
    lines.push(chalk.yellow('An error occurred while processing your request.'));
  }

  if (errorData.correlationId) {
    lines.push('');
    lines.push(chalk.gray(`Correlation ID: ${errorData.correlationId}`));
  }

  return lines.join('\n');
}

/**
 * Parses error response into error data object
 * @param {string|Object} errorResponse - Error response (string or parsed JSON)
 * @returns {Object} Parsed error data object
 */
function parseErrorData(errorResponse) {
  if (errorResponse === undefined || errorResponse === null) {
    return { message: 'Unknown error occurred' };
  }
  if (typeof errorResponse === 'string') {
    try {
      return JSON.parse(errorResponse);
    } catch {
      return { message: errorResponse };
    }
  }
  if (typeof errorResponse === 'object') {
    return errorResponse;
  }
  return { message: String(errorResponse) };
}

/**
 * Creates error result object
 * @param {string} type - Error type
 * @param {string} message - Error message
 * @param {string} formatted - Formatted error message
 * @param {Object} data - Error data
 * @returns {Object} Error result object
 */
function createErrorResult(type, message, formatted, data) {
  return { type, message, formatted, data };
}

/**
 * Gets error message from error data
 * @param {Object} errorData - Error data object
 * @param {string} defaultMessage - Default message if not found
 * @returns {string} Error message
 */
function getErrorMessage(errorData, defaultMessage) {
  return errorData.detail || errorData.title || errorData.errorDescription || errorData.message || errorData.error || defaultMessage;
}

/**
 * Handles 400 validation error
 * @param {Object} errorData - Error data object
 * @returns {Object} Error result object
 */
function handleValidationError(errorData) {
  const errorMessage = getErrorMessage(errorData, 'Validation error');
  return createErrorResult('validation', errorMessage, formatValidationError(errorData), errorData);
}

/**
 * Handles specific 4xx client error codes
 * @param {number} statusCode - HTTP status code
 * @param {Object} errorData - Error data object
 * @returns {Object|null} Error result object or null if not handled
 */
function handleSpecificClientErrors(statusCode, errorData) {
  switch (statusCode) {
  case 403:
    return createErrorResult('permission', 'Permission denied', formatPermissionError(errorData), errorData);
  case 401:
    return createErrorResult('authentication', 'Authentication failed', formatAuthenticationError(errorData), errorData);
  case 400:
    return handleValidationError(errorData);
  case 404:
    return createErrorResult('notfound', getErrorMessage(errorData, 'Not found'), formatNotFoundError(errorData), errorData);
  case 409:
    return createErrorResult('conflict', getErrorMessage(errorData, 'Conflict'), formatConflictError(errorData), errorData);
  default:
    return null;
  }
}

/**
 * Handles HTTP status code errors
 * @param {number} statusCode - HTTP status code
 * @param {Object} errorData - Error data object
 * @returns {Object|null} Error result object or null if not handled
 */
function handleStatusCodeError(statusCode, errorData) {
  // Handle 4xx client errors
  if (statusCode >= 400 && statusCode < 500) {
    return handleSpecificClientErrors(statusCode, errorData);
  }
  // Handle 5xx server errors
  if (statusCode >= 500) {
    return createErrorResult('server', 'Server error', formatServerError(errorData), errorData);
  }
  return null;
}

/**
 * Parses error response and determines error type
 * @param {string|Object} errorResponse - Error response (string or parsed JSON)
 * @param {number} statusCode - HTTP status code
 * @param {boolean} isNetworkError - Whether this is a network error
 * @returns {Object} Parsed error object with type, message, and formatted output
 */
function parseErrorResponse(errorResponse, statusCode, isNetworkError) {
  let errorData = parseErrorData(errorResponse);

  // Handle nested response structure (some APIs wrap errors in data field)
  if (errorData.data && typeof errorData.data === 'object') {
    errorData = errorData.data;
  }

  // Handle network errors
  if (isNetworkError) {
    const errorMessage = errorData.message || errorResponse || 'Network error';
    return createErrorResult('network', errorMessage, formatNetworkError(errorMessage, errorData), errorData);
  }

  // Handle HTTP status codes
  const statusError = handleStatusCodeError(statusCode, errorData);
  if (statusError) {
    return statusError;
  }

  // Generic error
  return createErrorResult('generic', errorData.message || errorData.error || 'Unknown error', formatGenericError(errorData, statusCode), errorData);
}

/**
 * Formats error for display in CLI
 * @param {Object} apiResponse - API response object from makeApiCall
 * @returns {string} Formatted error message
 */
function formatApiError(apiResponse) {
  if (!apiResponse || apiResponse.success !== false) {
    return chalk.red('❌ Unknown error occurred');
  }

  // Use formattedError if already available
  if (apiResponse.formattedError) {
    return apiResponse.formattedError;
  }

  const errorResponse = apiResponse.error || apiResponse.data || '';
  const statusCode = apiResponse.status || 0;
  const isNetworkError = apiResponse.network === true;

  const parsed = parseErrorResponse(errorResponse, statusCode, isNetworkError);
  return parsed.formatted;
}
module.exports = {
  parseErrorResponse,
  formatApiError,
  formatPermissionError,
  formatValidationError,
  formatAuthenticationError,
  formatConflictError,
  formatNetworkError,
  formatServerError,
  formatGenericError
};
