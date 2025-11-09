/**
 * AI Fabrix Builder Audit Logger
 *
 * ISO 27001 compliant structured logging for audit trails.
 * Provides secure, audit-ready logging with sensitive data masking.
 *
 * @fileoverview Audit and compliance logging for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

/* eslint-disable no-console */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Audit log file path (in user's home directory for compliance)
let auditLogPath = null;

/**
 * Gets the audit log file path
 * Creates .aifabrix directory in user's home if it doesn't exist
 * @returns {Promise<string>} Path to audit log file
 */
async function getAuditLogPath() {
  if (auditLogPath) {
    return auditLogPath;
  }

  const homeDir = os.homedir();
  const aifabrixDir = path.join(homeDir, '.aifabrix');

  try {
    await fs.mkdir(aifabrixDir, { recursive: true });
  } catch (error) {
    // If we can't create the directory, fall back to current directory
    const fallbackDir = path.join(process.cwd(), '.aifabrix');
    try {
      await fs.mkdir(fallbackDir, { recursive: true });
      auditLogPath = path.join(fallbackDir, 'audit.log');
      return auditLogPath;
    } catch {
      // Last resort: use temp directory
      auditLogPath = path.join(os.tmpdir(), 'aifabrix-audit.log');
      return auditLogPath;
    }
  }

  auditLogPath = path.join(aifabrixDir, 'audit.log');
  return auditLogPath;
}

/**
 * Masks sensitive data in strings
 * Prevents secrets, keys, and passwords from appearing in logs
 *
 * @param {string} value - Value to mask
 * @returns {string} Masked value
 */
function maskSensitiveData(value) {
  if (!value || typeof value !== 'string') {
    return value;
  }

  // Mask patterns: passwords, secrets, keys, tokens
  const sensitivePatterns = [
    { pattern: /password[=:]\s*([^\s]+)/gi, replacement: 'password=***' },
    { pattern: /secret[=:]\s*([^\s]+)/gi, replacement: 'secret=***' },
    { pattern: /key[=:]\s*([^\s]+)/gi, replacement: 'key=***' },
    { pattern: /token[=:]\s*([^\s]+)/gi, replacement: 'token=***' },
    { pattern: /api[_-]?key[=:]\s*([^\s]+)/gi, replacement: 'api_key=***' }
  ];

  let masked = value;
  for (const { pattern, replacement } of sensitivePatterns) {
    masked = masked.replace(pattern, replacement);
  }

  // If value looks like a hash/key (long hex string), mask it
  if (/^[a-f0-9]{32,}$/i.test(masked.trim())) {
    return '***';
  }

  return masked;
}

/**
 * Creates an audit log entry with ISO 27001 compliance
 *
 * @param {string} level - Log level (INFO, WARN, ERROR, AUDIT)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Structured log entry
 */
function createAuditEntry(level, message, metadata = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message: maskSensitiveData(message),
    metadata: {}
  };

  // Mask sensitive metadata
  // Only include non-null, non-undefined values to avoid cluttering logs
  for (const [key, value] of Object.entries(metadata)) {
    // Skip null and undefined values to keep logs clean
    if (value !== null && value !== undefined) {
      entry.metadata[key] = maskSensitiveData(
        typeof value === 'string' ? value : JSON.stringify(value)
      );
    }
  }

  return entry;
}

/**
 * Logs audit entry to file (structured JSON format)
 * Only prints to console if AUDIT_LOG_CONSOLE environment variable is set
 *
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
async function auditLog(level, message, metadata) {
  const entry = createAuditEntry(level, message, metadata);
  const logLine = JSON.stringify(entry) + '\n';

  // Write to audit log file (for ISO 27001 compliance)
  try {
    const logPath = await getAuditLogPath();
    await fs.appendFile(logPath, logLine, 'utf8');
  } catch (writeError) {
    // If file write fails, fall back to console.error (but don't show audit log)
    // This ensures we don't lose audit trail even if file system fails
    console.error(`[AUDIT LOG ERROR] Failed to write audit log: ${writeError.message}`);
  }

  // Only print to console if explicitly requested (for debugging/compliance review)
  if (process.env.AUDIT_LOG_CONSOLE === 'true' || process.env.AUDIT_LOG_CONSOLE === '1') {
    console.log(logLine.trim());
  }
}

/**
 * Logs deployment attempt with full audit trail
 *
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL
 * @param {Object} options - Deployment options
 */
async function logDeploymentAttempt(appName, controllerUrl, options = {}) {
  const metadata = {
    action: 'deploy',
    appName,
    controllerUrl,
    environment: options.environment || 'unknown',
    timestamp: Date.now()
  };

  // Only include api field if it's provided and not null
  if (options.api !== undefined && options.api !== null) {
    metadata.api = options.api;
  }

  await auditLog('AUDIT', 'Deployment initiated', metadata);
}

/**
 * Logs deployment success
 *
 * @param {string} appName - Application name
 * @param {string} deploymentId - Deployment ID
 * @param {string} controllerUrl - Controller URL
 */
async function logDeploymentSuccess(appName, deploymentId, controllerUrl) {
  await auditLog('AUDIT', 'Deployment succeeded', {
    action: 'deploy',
    appName,
    deploymentId,
    controllerUrl,
    status: 'success',
    timestamp: Date.now()
  });
}

/**
 * Logs deployment failure with error details
 *
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL
 * @param {Error} error - Error that occurred
 */
async function logDeploymentFailure(appName, controllerUrl, error) {
  await auditLog('ERROR', 'Deployment failed', {
    action: 'deploy',
    appName,
    controllerUrl,
    status: 'failure',
    errorMessage: error.message,
    errorCode: error.code || 'UNKNOWN',
    timestamp: Date.now()
  });
}

/**
 * Logs security-related events
 *
 * @param {string} event - Security event name
 * @param {Object} details - Event details
 */
async function logSecurityEvent(event, details = {}) {
  await auditLog('AUDIT', `Security event: ${event}`, {
    eventType: 'security',
    event,
    ...details,
    timestamp: Date.now()
  });
}

/**
 * Logs application creation event
 * Tracks when new applications are created for audit trail
 *
 * @param {string} appName - Application name
 * @param {Object} options - Creation options
 */
async function logApplicationCreation(appName, options = {}) {
  const metadata = {
    action: 'create',
    appName,
    language: options.language || 'unknown',
    port: options.port || 'unknown',
    hasDatabase: options.database || false,
    hasRedis: options.redis || false,
    hasStorage: options.storage || false,
    hasAuthentication: options.authentication || false,
    template: options.template || null,
    timestamp: Date.now()
  };

  // Only include api field if it's provided and not null
  // For local operations (create), api is typically null
  if (options.api !== undefined && options.api !== null) {
    metadata.api = options.api;
  }

  await auditLog('AUDIT', 'Application created', metadata);
}

/**
 * Logs API call attempt with full details for audit trail
 * Logs both successful and failed API calls for troubleshooting
 *
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options (method, headers, etc.)
 * @param {number} statusCode - HTTP status code
 * @param {number} duration - Request duration in milliseconds
 * @param {boolean} success - Whether the request was successful
 * @param {Object} errorInfo - Error information (if failed)
 */
async function logApiCall(url, options, statusCode, duration, success, errorInfo = {}) {
  const method = options.method || 'GET';
  const path = extractPathFromUrl(url);

  // Extract controller URL from full URL
  let controllerUrl = 'unknown';
  try {
    const urlObj = new URL(url);
    controllerUrl = `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    // If URL parsing fails, use the original URL
    controllerUrl = url;
  }

  const metadata = {
    action: 'api_call',
    method,
    path,
    url: maskSensitiveData(url),
    controllerUrl: maskSensitiveData(controllerUrl),
    statusCode,
    duration,
    success,
    timestamp: Date.now()
  };

  // Add error details if request failed
  if (!success) {
    metadata.errorType = errorInfo.errorType || 'unknown';
    metadata.errorMessage = errorInfo.errorMessage || 'Unknown error';

    // Include correlation ID if available
    if (errorInfo.correlationId) {
      metadata.correlationId = errorInfo.correlationId;
    }

    // Include error data (masked) if available
    if (errorInfo.errorData) {
      const errorDataStr = typeof errorInfo.errorData === 'string'
        ? errorInfo.errorData
        : JSON.stringify(errorInfo.errorData);
      metadata.errorData = maskSensitiveData(errorDataStr);
    }
  }

  // Log as ERROR for failed requests, INFO for successful ones
  const level = success ? 'INFO' : 'ERROR';
  const message = success
    ? `API call succeeded: ${method} ${path}`
    : `API call failed: ${method} ${path} (${statusCode})`;

  await auditLog(level, message, metadata);
}

/**
 * Extracts path and query string from full URL
 * @param {string} url - Full URL
 * @returns {string} Path with query string
 */
function extractPathFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname + urlObj.search;
  } catch {
    // If URL parsing fails, try to extract path manually
    const match = url.match(/https?:\/\/[^/]+(\/.*)/);
    return match ? match[1] : url;
  }
}

module.exports = {
  auditLog,
  logDeploymentAttempt,
  logDeploymentSuccess,
  logDeploymentFailure,
  logSecurityEvent,
  logApplicationCreation,
  logApiCall,
  maskSensitiveData,
  createAuditEntry
};

