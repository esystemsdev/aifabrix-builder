/**
 * AI Fabrix Builder Deployment Module
 *
 * Handles deployment to Miso Controller API with ISO 27001 security measures.
 * Manages authentication, validation, and API communication for deployments.
 *
 * @fileoverview Deployment orchestration and API communication
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const axios = require('axios');
const chalk = require('chalk');
const auditLogger = require('./audit-logger');
const logger = require('./utils/logger');

/**
 * Validates and sanitizes controller URL
 * Enforces HTTPS-only communication for security
 *
 * @param {string} url - Controller URL to validate
 * @throws {Error} If URL is invalid or uses HTTP
 */
function validateControllerUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Controller URL is required and must be a string');
  }

  // Must use HTTPS for security (allow http://localhost for local development)
  if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
    throw new Error('Controller URL must use HTTPS (https://) or http://localhost');
  }

  // Basic URL format validation
  const urlPattern = /^(https?):\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*(localhost)?(:[0-9]+)?(\/.*)?$/;
  if (!urlPattern.test(url)) {
    throw new Error('Invalid controller URL format');
  }

  // Remove trailing slash if present
  return url.replace(/\/$/, '');
}

/**
 * Creates authentication headers for Client Credentials flow
 *
 * @param {string} clientId - Application client ID
 * @param {string} clientSecret - Application client secret
 * @returns {Object} Headers object with authentication
 * @throws {Error} If credentials are missing
 */
function createClientCredentialsHeaders(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    throw new Error('Client ID and Client Secret are required for authentication');
  }
  return {
    'x-client-id': clientId,
    'x-client-secret': clientSecret
  };
}

/**
 * Validates environment key
 * @param {string} envKey - Environment key to validate
 * @throws {Error} If environment key is invalid
 */
function validateEnvironmentKey(envKey) {
  if (!envKey || typeof envKey !== 'string') {
    throw new Error('Environment key is required and must be a string');
  }

  const validEnvironments = ['miso', 'dev', 'tst', 'pro'];
  if (!validEnvironments.includes(envKey.toLowerCase())) {
    throw new Error(`Invalid environment key: ${envKey}. Must be one of: ${validEnvironments.join(', ')}`);
  }

  return envKey.toLowerCase();
}

/**
 * Sends deployment manifest to Miso Controller with Client Credentials authentication
 *
 * @async
 * @param {string} url - Controller URL
 * @param {string} envKey - Environment key (dev, tst, pro)
 * @param {Object} manifest - Deployment manifest
 * @param {string} clientId - Client ID for authentication
 * @param {string} clientSecret - Client Secret for authentication
 * @param {Object} options - Deployment options (timeout, retries, etc.)
 * @returns {Promise<Object>} Deployment result from controller
 * @throws {Error} If deployment fails
 */
async function sendDeploymentRequest(url, envKey, manifest, clientId, clientSecret, options = {}) {
  // Validate environment key
  const validatedEnvKey = validateEnvironmentKey(envKey);

  // Environment-aware endpoint
  const endpoint = `${url}/api/pipeline/${validatedEnvKey}/deploy`;
  const timeout = options.timeout || 30000;
  const maxRetries = options.maxRetries || 3;

  const requestConfig = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'aifabrix-builder/2.0.0',
      ...createClientCredentialsHeaders(clientId, clientSecret)
    },
    timeout,
    validateStatus: (status) => status < 500 // Don't throw on 4xx errors
  };

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(endpoint, manifest, requestConfig);

      // Check for HTTP errors
      if (response.status >= 400) {
        const error = new Error(`Controller returned error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        };
        error.data = response.data;
        throw error;
      }

      return response.data;

    } catch (error) {
      lastError = error;

      // Log retry attempt
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        logger.log(chalk.yellow(`⚠️  Deployment attempt ${attempt} failed, retrying in ${delay}ms...`));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw new Error(`Deployment failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Polls deployment status from controller
 *
 * @async
 * @param {string} deploymentId - Deployment ID to poll
 * @param {string} controllerUrl - Controller URL
 * @param {string} envKey - Environment key
 * @param {string} clientId - Client ID for authentication
 * @param {string} clientSecret - Client Secret for authentication
 * @param {Object} options - Polling options (interval, maxAttempts, etc.)
 * @returns {Promise<Object>} Deployment status
 */
async function pollDeploymentStatus(deploymentId, controllerUrl, envKey, clientId, clientSecret, options = {}) {
  const interval = options.interval || 5000;
  const maxAttempts = options.maxAttempts || 60; // 5 minutes max

  // Environment-aware status endpoint
  const validatedEnvKey = validateEnvironmentKey(envKey);
  const statusEndpoint = `${controllerUrl}/api/environments/${validatedEnvKey}/deployments/${deploymentId}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.get(statusEndpoint, {
        headers: createClientCredentialsHeaders(clientId, clientSecret),
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      if (response.status === 200) {
        const status = response.data.status;

        // Terminal states
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
          return response.data;
        }

        // Log progress
        logger.log(chalk.blue(`   Status: ${status} (attempt ${attempt + 1}/${maxAttempts})`));

        // Wait before next poll
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, interval));
        }
      } else {
        throw new Error(`Status check failed: ${response.status}`);
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }
      throw error;
    }
  }

  throw new Error('Deployment timeout: Maximum polling attempts reached');
}

/**
 * Handles deployment errors with security-aware messages
 *
 * @param {Error} error - Error to handle
 * @returns {Object} Structured error information
 */
function handleDeploymentError(error) {
  const safeError = {
    message: error.message,
    code: error.code || 'UNKNOWN',
    timeout: error.code === 'ECONNABORTED',
    status: error.status || error.response?.status,
    data: error.data || error.response?.data
  };

  // Mask sensitive information in error messages
  safeError.message = auditLogger.maskSensitiveData(safeError.message);

  return safeError;
}

/**
 * Deploys application to Miso Controller with Client Credentials authentication
 * Main orchestrator for the deployment process
 *
 * @async
 * @param {Object} manifest - Deployment manifest
 * @param {string} controllerUrl - Controller URL
 * @param {string} envKey - Environment key (dev, tst, pro)
 * @param {string} clientId - Client ID for authentication
 * @param {string} clientSecret - Client Secret for authentication
 * @param {Object} options - Deployment options
 * @returns {Promise<Object>} Deployment result
 * @throws {Error} If deployment fails
 */
async function deployToController(manifest, controllerUrl, envKey, clientId, clientSecret, options = {}) {
  // Validate inputs
  if (!envKey) {
    throw new Error('Environment key is required');
  }
  if (!clientId || !clientSecret) {
    throw new Error('Client ID and Client Secret are required for authentication');
  }

  // Validate and sanitize controller URL
  const url = validateControllerUrl(controllerUrl);
  const validatedEnvKey = validateEnvironmentKey(envKey);

  // Log deployment attempt for audit
  auditLogger.logDeploymentAttempt(manifest.key, url, options);

  try {
    // Send deployment request
    logger.log(chalk.blue(`📤 Sending deployment request to ${url}/api/pipeline/${validatedEnvKey}/deploy...`));
    const result = await sendDeploymentRequest(url, validatedEnvKey, manifest, clientId, clientSecret, {
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3
    });

    // Log success
    if (result.deploymentId) {
      auditLogger.logDeploymentSuccess(manifest.key, result.deploymentId, url);
    }

    // Poll for deployment status if enabled
    if (options.poll && result.deploymentId) {
      logger.log(chalk.blue(`\n⏳ Polling deployment status (${options.pollInterval || 5000}ms intervals)...`));
      const status = await pollDeploymentStatus(
        result.deploymentId,
        url,
        validatedEnvKey,
        clientId,
        clientSecret,
        {
          interval: options.pollInterval || 5000,
          maxAttempts: options.pollMaxAttempts || 60
        }
      );
      result.status = status;
    }

    return result;

  } catch (error) {
    // Log failure for audit
    auditLogger.logDeploymentFailure(manifest.key, url, error);

    // Handle and re-throw with safe error
    const safeError = handleDeploymentError(error);

    // Provide user-friendly error messages
    if (safeError.status === 401 || safeError.status === 403) {
      throw new Error('Authentication failed. Check your client ID and client secret.');
    } else if (safeError.status === 400) {
      throw new Error('Invalid deployment manifest. Please check your configuration.');
    } else if (safeError.status === 404) {
      throw new Error('Controller endpoint not found. Check the controller URL and environment.');
    } else if (safeError.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to controller. Check if the controller is running.');
    } else if (safeError.code === 'ENOTFOUND') {
      throw new Error('Controller hostname not found. Check your controller URL.');
    } else if (safeError.timeout) {
      throw new Error('Request timed out. The controller may be overloaded.');
    }

    throw new Error(safeError.message);
  }
}

module.exports = {
  deployToController,
  sendDeploymentRequest,
  pollDeploymentStatus,
  validateControllerUrl,
  handleDeploymentError,
  createClientCredentialsHeaders,
  validateEnvironmentKey
};

