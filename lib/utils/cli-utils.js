/**
 * CLI Utility Functions
 *
 * Utility functions for CLI command handling and validation.
 *
 * @fileoverview CLI utilities for error handling and validation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const chalk = require('chalk');
const logger = require('./logger');
const { getDockerDaemonStartHintSentence, getDockerApiOverTcpHintLines } = require('./docker-not-running-hint');

/**
 * Validates a command and its options
 * @param {string} _command - Command name
 * @param {Object} _options - Command options
 * @returns {boolean} True if valid
 */
function validateCommand(_command, _options) {
  // TODO: Implement command validation
  // TODO: Add helpful error messages for common issues
  return true;
}

/**
 * Format already formatted error message
 * @param {string} formatted - Formatted error message
 * @returns {string[]} Array of error message lines
 */
function formatFormattedError(formatted) {
  const messages = [];
  const lines = formatted.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      messages.push(`   ${line}`);
    }
  });
  return messages;
}

/**
 * Checks if error is about Docker image not found
 * @function isDockerImageNotFoundError
 * @param {string} errorMsg - Error message
 * @returns {boolean} True if Docker image not found error
 */
function isDockerImageNotFoundError(errorMsg) {
  return errorMsg.includes('not found locally') ||
    (errorMsg.includes('Docker image') && errorMsg.includes('not found'));
}

/**
 * Checks if error is about Docker not running/installed
 * @function isDockerNotRunningError
 * @param {string} errorMsg - Error message
 * @returns {boolean} True if Docker not running error
 */
function isDockerNotRunningError(errorMsg) {
  return errorMsg.includes('Docker') &&
    (errorMsg.includes('not running') || errorMsg.includes('not installed') || errorMsg.includes('Cannot connect'));
}

/**
 * Checks if error is about port conflict
 * @function isPortConflictError
 * @param {string} errorMsg - Error message
 * @returns {boolean} True if port conflict error
 */
function isPortConflictError(errorMsg) {
  return errorMsg.toLowerCase().includes('port') &&
    (errorMsg.includes('already in use') || errorMsg.includes('in use') || errorMsg.includes('conflict'));
}

/**
 * Checks if error is about permission denied (excluding permissions field)
 * @function isPermissionDeniedError
 * @param {string} errorMsg - Error message
 * @returns {boolean} True if permission denied error
 */
function isPermissionDeniedError(errorMsg) {
  return (errorMsg.includes('permission denied') || errorMsg.includes('EACCES') || errorMsg.includes('Permission denied')) &&
    !errorMsg.includes('permissions/') &&
    !errorMsg.includes('Field "permissions');
}

/**
 * Checks if permission denied error is Docker-related (daemon socket / CLI), not API auth.
 * Used to avoid showing Docker hints when the error is from Controller/Dataplane "Permission denied".
 * @function isDockerPermissionDeniedError
 * @param {string} errorMsg - Error message
 * @returns {boolean} True if Docker permission denied error
 */
function isDockerPermissionDeniedError(errorMsg) {
  if (!isPermissionDeniedError(errorMsg)) return false;
  const lower = errorMsg.toLowerCase();
  // Do not treat every EACCES as Docker (e.g. mkdir on a bogus server-side secrets path).
  return lower.includes('docker') || lower.includes('docker.sock') || lower.includes('/var/run/docker');
}

/**
 * Format Docker-related errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not a Docker error
 */
function formatDockerError(errorMsg) {
  if (isDockerImageNotFoundError(errorMsg)) {
    // Preserve custom hint for template apps (keycloak, miso-controller) from up-miso/up-dataplane
    if (errorMsg.includes('use --image') || errorMsg.includes('Pull the image')) {
      return errorMsg.split('\n').map(line => (line.trim() ? `   ${line.trim()}` : ''));
    }
    return [
      '   Docker image not found.',
      '   Run: aifabrix build <app> first'
    ];
  }
  if (isDockerNotRunningError(errorMsg)) {
    return [
      '   Docker is not running or not installed.',
      `   ${getDockerDaemonStartHintSentence()}`,
      ...getDockerApiOverTcpHintLines()
    ];
  }
  if (isPortConflictError(errorMsg)) {
    return [
      '   Port conflict detected.',
      '   Run "aifabrix doctor" to check which ports are in use.'
    ];
  }
  if (isDockerPermissionDeniedError(errorMsg)) {
    return [
      '   Permission denied when using Docker (e.g. unix socket).',
      '   On Linux you can add your user to the "docker" group and log in again, or use the Engine API via docker-endpoint:',
      ...getDockerApiOverTcpHintLines()
    ];
  }
  return null;
}

/**
 * True when the message indicates the Azure CLI binary is missing or not logged in.
 * Do not use a naive "az"+"failed" substring match: "azurecr.io", "Azure", "lazy", "amazon", etc. contain "az".
 * @param {string} errorMsg - Error message
 * @returns {boolean}
 */
function isAzureCliToolingError(errorMsg) {
  if (errorMsg.includes('Azure CLI is not installed')) return true;
  if (errorMsg.includes('az --version failed')) return true;
  if (errorMsg.includes('Not logged in to Azure')) return true;
  if (errorMsg.includes('az: command not found')) return true;
  if (errorMsg.includes('az.cmd: command not found')) return true;
  if (errorMsg.includes('\'az\' is not recognized') || errorMsg.includes('"az" is not recognized')) return true;
  return false;
}

/**
 * Format Azure-related errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not an Azure error
 */
function formatAzureError(errorMsg) {
  if (isAzureCliToolingError(errorMsg)) {
    return [
      '   Azure CLI is not installed or not working properly.',
      '   Install from: https://docs.microsoft.com/cli/azure/install-azure-cli',
      '   Run: az login'
    ];
  }
  if (errorMsg.includes('Invalid ACR URL') || errorMsg.includes('Invalid registry URL') || errorMsg.includes('Expected format')) {
    return [
      '   Invalid registry URL format.',
      '   Use format: *.azurecr.io (e.g., myacr.azurecr.io)'
    ];
  }
  // Only match ACR-specific authentication errors, not general authentication failures
  if (errorMsg.includes('ACR') || errorMsg.includes('azurecr.io') ||
      (errorMsg.includes('authenticate') && (errorMsg.includes('registry') || errorMsg.includes('container')))) {
    return [
      '   Azure Container Registry authentication failed.',
      '   Run: az acr login --name <registry-name>',
      '   Or login to Azure: az login'
    ];
  }
  if (errorMsg.includes('Registry URL is required')) {
    return [
      '   Registry URL is required.',
      '   Provide via --registry flag or configure in application.yaml under image.registry'
    ];
  }
  return null;
}

/**
 * Format secrets-related errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not a secrets error
 */
function formatSecretsError(errorMsg) {
  if (!errorMsg.includes('Missing secrets')) {
    return null;
  }

  const messages = [];
  const missingSecretsMatch = errorMsg.match(/Missing secrets: ([^\n]+)/);
  const fileInfoMatch = errorMsg.match(/Secrets file location: ([^\n]+)/);
  const resolveMatch = errorMsg.match(/Run "aifabrix resolve ([^"]+)"/);

  if (missingSecretsMatch) {
    messages.push(`   Missing secrets: ${missingSecretsMatch[1]}`);
  } else {
    messages.push('   Missing secrets in secrets file.');
  }

  if (fileInfoMatch) {
    messages.push(`   Secrets file location: ${fileInfoMatch[1]}`);
  }

  if (resolveMatch) {
    messages.push(`   Run: aifabrix resolve ${resolveMatch[1]} to generate missing secrets.`);
  } else {
    messages.push('   Run: aifabrix resolve <app-name> to generate missing secrets.');
  }

  return messages;
}

/**
 * Format deployment-related errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not a deployment error
 */
function formatDeploymentError(errorMsg) {
  if (!errorMsg.includes('Deployment failed after')) {
    return null;
  }

  const match = errorMsg.match(/Deployment failed after \d+ attempts: (.+)/);
  if (match) {
    return [`   ${match[1]}`];
  }
  return [`   ${errorMsg}`];
}

/**
 * Format validation errors
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not a validation error
 */
function formatValidationError(errorMsg) {
  if (errorMsg.includes('Configuration not found') ||
      errorMsg.includes('does not match schema') ||
      errorMsg.includes('Validation failed') ||
      errorMsg.includes('Field "') ||
      errorMsg.includes('Invalid format')) {
    return [`   ${errorMsg}`];
  }
  return null;
}

/**
 * Format API/Controller/Dataplane permission errors (403-style "Permission denied").
 * Keeps the real message and adds a hint; avoids mis-classifying as Docker.
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Array of error message lines or null if not an API permission error
 */
function formatApiPermissionError(errorMsg) {
  if (!isPermissionDeniedError(errorMsg)) return null;
  if (isDockerPermissionDeniedError(errorMsg)) return null;
  return [
    `   ${errorMsg}`,
    '   Ensure your token has the required permission (e.g. external-system:delete for delete).'
  ];
}

/**
 * Formats error message based on error type
 * @function formatError
 * @param {Error} error - The error that occurred
 * @returns {string[]} Array of error message lines
 */
/**
 * Tries to format error using specific formatters
 * @function tryFormatErrorWithFormatters
 * @param {string} errorMsg - Error message
 * @returns {string[]|null} Formatted error messages or null if no formatter matched
 */
/**
 * up-infra / checkDockerAvailability: multi-line "Cannot use Docker for infrastructure" + docker-endpoint hint.
 * @param {string} errorMsg - Error message
 * @returns {string[]|null}
 */
function formatCannotUseDockerInfrastructureError(errorMsg) {
  if (!errorMsg.includes('Cannot use Docker for infrastructure')) {
    return null;
  }
  const lines = errorMsg.split('\n').map((l) => l.trim()).filter(Boolean);
  const out = lines.map((l) => `   ${l}`);
  out.push(...getDockerApiOverTcpHintLines());
  return out;
}

function tryFormatErrorWithFormatters(errorMsg) {
  const formatters = [
    formatCannotUseDockerInfrastructureError,
    formatApiPermissionError,
    formatDockerError,
    formatAzureError,
    formatSecretsError,
    formatDeploymentError,
    formatValidationError
  ];

  for (const formatter of formatters) {
    const formatted = formatter(errorMsg);
    if (formatted) {
      return formatted;
    }
  }

  return null;
}

function formatError(error) {
  // If error has formatted message (from API error handler), use it directly
  if (error.formatted) {
    return formatFormattedError(error.formatted);
  }

  const errorMsg = error.message || '';

  // Try different error formatters in order of specificity
  const formatted = tryFormatErrorWithFormatters(errorMsg);
  if (formatted) {
    return formatted;
  }

  // Default: return generic error message
  return [`   ${errorMsg}`];
}

/**
 * Logs error messages
 * @function logError
 * @param {string} command - Command that failed
 * @param {string[]} errorMessages - Error message lines
 */
function logError(command, errorMessages) {
  logger.error(`\n❌ Error in ${command} command:`);
  errorMessages.forEach(msg => logger.error(msg));
  logger.error('\n💡 Run "aifabrix doctor" for environment diagnostics.\n');
}

/**
 * Logs the resolved app path so the user can see which directory (integration/<app> or builder/<app>) is used.
 * Path resolution order is always integration first, then builder; no CLI flag overrides this.
 *
 * @param {string} appPath - Resolved application directory path
 * @param {Object} [_options] - Reserved for backward compatibility; ignored
 */
function logOfflinePathWhenType(appPath, options) {
  if (!appPath || !options || (options.type !== 'app' && options.type !== 'external')) return;
  const displayPath = path.relative(process.cwd(), appPath) || appPath;
  logger.log(chalk.gray(`Using: ${displayPath}`));
}

/**
 * Returns true if the error is likely due to authentication failure (e.g. 401, token expired, login required).
 * Used to show "Run: aifabrix login" for commands that require Controller auth (e.g. up-dataplane).
 * @param {Error} error - The error that occurred
 * @returns {boolean} True if the error appears to be auth-related
 */
function isAuthenticationError(error) {
  if (!error) return false;
  if (error.authFailure === true) return true;
  const msg = (error.message || '').toLowerCase();
  const formatted = (typeof error.formatted === 'string' ? error.formatted : '').toLowerCase();
  const combined = `${msg} ${formatted}`;
  return /401|unauthorized|authentication|token expired|login required|aifabrix login|no authentication|device token|refresh token/.test(combined);
}

/**
 * Handles command errors with user-friendly messages
 * @param {Error} error - The error that occurred
 * @param {string} command - Command that failed
 */
function handleCommandError(error, command) {
  const errorMessages = formatError(error);
  logError(command, errorMessages);
  if (error.wizardResumeMessage) {
    logger.log(error.wizardResumeMessage);
  }
}

/** Strip ANSI escape codes for plain-text logging (ESC [...] m) */
// eslint-disable-next-line no-control-regex -- intentional: match ANSI CSI sequences
const ANSI_CODE_RE = /\x1b\[[\d;]*m/g;
function stripAnsi(str) {
  return typeof str === 'string' ? str.replace(ANSI_CODE_RE, '') : str;
}

/**
 * Appends a wizard error to integration/<appKey>/error.log (timestamp + message only; no stack or secrets).
 * Uses full formatted message (with validation details) when error.formatted is set, stripped of ANSI.
 * Does not throw; logs and ignores write failures.
 * @param {string} appKey - Application/integration key (e.g. app name or system key)
 * @param {Error} error - The error that occurred
 * @returns {Promise<void>}
 */
async function appendWizardError(appKey, error) {
  if (!appKey || typeof appKey !== 'string' || !/^[a-z0-9-_]+$/.test(appKey)) {
    return;
  }
  const dir = path.join(process.cwd(), 'integration', appKey);
  const logPath = path.join(dir, 'error.log');
  const rawMessage = (error && error.message) ? String(error.message) : String(error);
  const fullPlain = (error && error.formatted) ? stripAnsi(error.formatted) : null;
  const message = fullPlain && fullPlain.length > rawMessage.length ? fullPlain : rawMessage;
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    const fsp = require('fs').promises;
    await fsp.mkdir(dir, { recursive: true });
    await fsp.appendFile(logPath, line, 'utf8');
  } catch (e) {
    logger.warn(`Could not write wizard error.log: ${e.message}`);
  }
}

module.exports = {
  validateCommand,
  handleCommandError,
  isAuthenticationError,
  appendWizardError,
  logOfflinePathWhenType
};

