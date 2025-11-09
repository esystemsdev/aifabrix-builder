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
 * Formats permission error with missing and required permissions
 * @param {Object} errorData - Error response data
 * @returns {string} Formatted permission error message
 */
function formatPermissionError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Permission Denied\n'));

  // Handle detail message if present
  if (errorData.detail) {
    lines.push(chalk.yellow(errorData.detail));
    lines.push('');
  }

  // Extract missing permissions (support both flat and nested structures)
  let missingPerms = [];
  if (errorData.missingPermissions && Array.isArray(errorData.missingPermissions)) {
    missingPerms = errorData.missingPermissions;
  } else if (errorData.missing && errorData.missing.permissions && Array.isArray(errorData.missing.permissions)) {
    missingPerms = errorData.missing.permissions;
  }

  if (missingPerms.length > 0) {
    lines.push(chalk.yellow('Missing permissions:'));
    missingPerms.forEach(perm => {
      lines.push(chalk.gray(`  - ${perm}`));
    });
    lines.push('');
  }

  // Extract required permissions (support both flat and nested structures)
  let requiredPerms = [];
  if (errorData.requiredPermissions && Array.isArray(errorData.requiredPermissions)) {
    requiredPerms = errorData.requiredPermissions;
  } else if (errorData.required && errorData.required.permissions && Array.isArray(errorData.required.permissions)) {
    requiredPerms = errorData.required.permissions;
  }

  if (requiredPerms.length > 0) {
    lines.push(chalk.yellow('Required permissions:'));
    requiredPerms.forEach(perm => {
      lines.push(chalk.gray(`  - ${perm}`));
    });
    lines.push('');
  }

  // Use instance (from RFC 7807) or url field
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
  // Priority: detail > title > message
  if (errorData.detail) {
    lines.push(chalk.yellow(errorData.detail));
    lines.push('');
  } else if (errorData.title) {
    lines.push(chalk.yellow(errorData.title));
    lines.push('');
  } else if (errorData.message) {
    lines.push(chalk.yellow(errorData.message));
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
 * Formats not found error (404)
 * @param {Object} errorData - Error response data
 * @returns {string} Formatted not found error message
 */
function formatNotFoundError(errorData) {
  const lines = [];
  lines.push(chalk.red('❌ Not Found\n'));

  // Extract detail from RFC 7807 Problem Details format
  const detail = errorData.detail || errorData.message || '';

  if (detail) {
    lines.push(chalk.yellow(detail));
    lines.push('');
  }

  // Provide actionable guidance based on error context
  if (detail.toLowerCase().includes('environment')) {
    lines.push(chalk.gray('Options:'));
    lines.push(chalk.gray('  • Check the environment key spelling'));
    lines.push(chalk.gray('  • List available environments: aifabrix app list -e <environment>'));
    lines.push(chalk.gray('  • Verify you have access to this environment'));
  } else if (detail.toLowerCase().includes('application')) {
    lines.push(chalk.gray('Options:'));
    lines.push(chalk.gray('  • Check the application key spelling'));
    lines.push(chalk.gray('  • List applications: aifabrix app list -e <environment>'));
    lines.push(chalk.gray('  • Verify the application exists in this environment'));
  } else {
    lines.push(chalk.gray('Options:'));
    lines.push(chalk.gray('  • Check the resource identifier'));
    lines.push(chalk.gray('  • Verify the resource exists'));
    lines.push(chalk.gray('  • Check your permissions'));
  }

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
 * Parses error response and determines error type
 * @param {string|Object} errorResponse - Error response (string or parsed JSON)
 * @param {number} statusCode - HTTP status code
 * @param {boolean} isNetworkError - Whether this is a network error
 * @returns {Object} Parsed error object with type, message, and formatted output
 */
function parseErrorResponse(errorResponse, statusCode, isNetworkError) {
  let errorData = {};

  // Handle undefined or null error response
  if (errorResponse === undefined || errorResponse === null) {
    errorData = { message: 'Unknown error occurred' };
  } else if (typeof errorResponse === 'string') {
    // Parse error response
    try {
      errorData = JSON.parse(errorResponse);
    } catch {
      errorData = { message: errorResponse };
    }
  } else if (typeof errorResponse === 'object') {
    errorData = errorResponse;
  } else {
    // Fallback for unexpected types
    errorData = { message: String(errorResponse) };
  }

  // Handle nested response structure (some APIs wrap errors in data field)
  if (errorData.data && typeof errorData.data === 'object') {
    errorData = errorData.data;
  }

  // Handle network errors
  if (isNetworkError) {
    const errorMessage = errorData.message || errorResponse || 'Network error';
    return {
      type: 'network',
      message: errorMessage,
      formatted: formatNetworkError(errorMessage, errorData),
      data: errorData
    };
  }

  // Handle different HTTP status codes
  if (statusCode === 403) {
    // Permission error
    return {
      type: 'permission',
      message: 'Permission denied',
      formatted: formatPermissionError(errorData),
      data: errorData
    };
  }

  if (statusCode === 401) {
    // Authentication error
    return {
      type: 'authentication',
      message: 'Authentication failed',
      formatted: formatAuthenticationError(errorData),
      data: errorData
    };
  }

  if (statusCode === 400) {
    // Validation error
    // Extract message from unified error format (RFC 7807)
    const errorMessage = errorData.detail || errorData.title || errorData.message || 'Validation error';
    return {
      type: 'validation',
      message: errorMessage,
      formatted: formatValidationError(errorData),
      data: errorData
    };
  }

  if (statusCode === 404) {
    // Not found error
    return {
      type: 'notfound',
      message: errorData.detail || errorData.message || 'Not found',
      formatted: formatNotFoundError(errorData),
      data: errorData
    };
  }

  if (statusCode === 409) {
    // Conflict error
    return {
      type: 'conflict',
      message: errorData.detail || errorData.message || 'Conflict',
      formatted: formatConflictError(errorData),
      data: errorData
    };
  }

  if (statusCode >= 500) {
    // Server error
    return {
      type: 'server',
      message: 'Server error',
      formatted: formatServerError(errorData),
      data: errorData
    };
  }

  // Generic error
  return {
    type: 'generic',
    message: errorData.message || errorData.error || 'Unknown error',
    formatted: formatGenericError(errorData, statusCode),
    data: errorData
  };
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

