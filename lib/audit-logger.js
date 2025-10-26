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
  for (const [key, value] of Object.entries(metadata)) {
    entry.metadata[key] = maskSensitiveData(
      typeof value === 'string' ? value : JSON.stringify(value)
    );
  }

  return entry;
}

/**
 * Logs audit entry to console (structured JSON format)
 *
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
function auditLog(level, message, metadata) {
  const entry = createAuditEntry(level, message, metadata);
  console.log(JSON.stringify(entry));
}

/**
 * Logs deployment attempt with full audit trail
 *
 * @param {string} appName - Application name
 * @param {string} controllerUrl - Controller URL
 * @param {Object} options - Deployment options
 */
function logDeploymentAttempt(appName, controllerUrl, options = {}) {
  auditLog('AUDIT', 'Deployment initiated', {
    action: 'deploy',
    appName,
    controllerUrl,
    environment: options.environment || 'unknown',
    timestamp: Date.now()
  });
}

/**
 * Logs deployment success
 *
 * @param {string} appName - Application name
 * @param {string} deploymentId - Deployment ID
 * @param {string} controllerUrl - Controller URL
 */
function logDeploymentSuccess(appName, deploymentId, controllerUrl) {
  auditLog('AUDIT', 'Deployment succeeded', {
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
function logDeploymentFailure(appName, controllerUrl, error) {
  auditLog('ERROR', 'Deployment failed', {
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
function logSecurityEvent(event, details = {}) {
  auditLog('AUDIT', `Security event: ${event}`, {
    eventType: 'security',
    event,
    ...details,
    timestamp: Date.now()
  });
}

module.exports = {
  auditLog,
  logDeploymentAttempt,
  logDeploymentSuccess,
  logDeploymentFailure,
  logSecurityEvent,
  maskSensitiveData,
  createAuditEntry
};

