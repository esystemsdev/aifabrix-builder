/**
 * AI Fabrix Builder Push Utilities
 *
 * This module handles pushing Docker images to Azure Container Registry.
 * Includes authentication, tagging, and push operations.
 *
 * @fileoverview Push utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const chalk = require('chalk');
const logger = require('./utils/logger');

const execAsync = promisify(exec);

/**
 * Check if Azure CLI is installed
 * @returns {Promise<boolean>} True if Azure CLI is available
 */
async function checkAzureCLIInstalled() {
  // On Windows, use shell option to ensure proper command resolution
  const options = process.platform === 'win32' ? { shell: true } : {};

  // Try multiple methods to detect Azure CLI (commands that don't require authentication)
  const commands = process.platform === 'win32'
    ? ['az --version', 'az.cmd --version']
    : ['az --version'];

  for (const command of commands) {
    try {
      // Use a timeout to avoid hanging if command doesn't exist
      await execAsync(command, { ...options, timeout: 5000 });
      return true;
    } catch (error) {
      // Log the error for debugging (only in development)
      if (process.env.DEBUG) {
        logger.log(chalk.gray(`[DEBUG] Command '${command}' failed: ${error.message}`));
      }
      // Continue to next command if this one fails
      continue;
    }
  }

  // If all commands failed, Azure CLI is not available
  // Log for debugging if enabled
  if (process.env.DEBUG) {
    logger.log(chalk.gray('[DEBUG] All Azure CLI detection methods failed'));
  }
  return false;
}

/**
 * Extract registry name from ACR URL
 * @param {string} registryUrl - Registry URL (e.g., myacr.azurecr.io)
 * @returns {string} Registry name (e.g., myacr)
 * @throws {Error} If URL format is invalid
 */
function extractRegistryName(registryUrl) {
  const match = registryUrl.match(/^([^/]+)\.azurecr\.io$/);
  if (!match) {
    throw new Error(`Invalid ACR URL format: ${registryUrl}. Expected format: *.azurecr.io`);
  }
  return match[1];
}

/**
 * Parses registry URL format
 * @function parseRegistryUrl
 * @param {string} registryUrl - Registry URL to parse
 * @returns {Object|null} Parsed registry info or null if invalid
 */
function parseRegistryUrl(registryUrl) {
  if (!registryUrl || typeof registryUrl !== 'string') {
    return null;
  }

  if (registryUrl.includes('://')) {
    return null;
  }

  if (/^[^.]+\.azurecr\.io$/.test(registryUrl)) {
    return { type: 'acr', valid: true };
  }

  if (registryUrl === 'docker.io' || registryUrl === 'index.docker.io') {
    return { type: 'dockerhub', valid: true };
  }

  if (registryUrl === 'ghcr.io') {
    return { type: 'ghcr', valid: true };
  }

  if (registryUrl === 'azurecr.io') {
    return null;
  }

  if (/^[^.]+\.azurecr\.com$/.test(registryUrl)) {
    return null;
  }

  if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?::[0-9]+)?$/.test(registryUrl)) {
    return { type: 'custom', valid: true };
  }

  return null;
}

/**
 * Validates registry URL format
 * @param {string} registryUrl - Registry URL to validate
 * @returns {boolean} True if valid
 */
function validateRegistryURL(registryUrl) {
  const parsed = parseRegistryUrl(registryUrl);
  return parsed !== null && parsed.valid;
}

/**
 * Check if already authenticated with ACR
 * @param {string} registry - Registry URL
 * @returns {Promise<boolean>} True if authenticated
 */
async function checkACRAuthentication(registry) {
  try {
    const registryName = extractRegistryName(registry);
    // On Windows, use shell option to ensure proper command resolution
    const options = process.platform === 'win32' ? { shell: true } : {};
    await execAsync(`az acr show --name ${registryName}`, options);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Authenticate with Azure Container Registry
 * @param {string} registry - Registry URL
 * @throws {Error} If authentication fails
 */
async function authenticateACR(registry) {
  try {
    const registryName = extractRegistryName(registry);
    logger.log(chalk.blue(`Authenticating with ${registry}...`));
    // On Windows, use shell option to ensure proper command resolution
    const options = process.platform === 'win32' ? { shell: true } : {};
    await execAsync(`az acr login --name ${registryName}`, options);
    logger.log(chalk.green(`✓ Authenticated with ${registry}`));
  } catch (error) {
    throw new Error(`Failed to authenticate with Azure Container Registry: ${error.message}`);
  }
}

/**
 * Authenticate with external registry
 * @param {string} registry - Registry URL
 * @param {string} username - Username for authentication
 * @param {string} password - Password or token for authentication
 * @throws {Error} If authentication fails
 */
async function authenticateExternalRegistry(registry, username, password) {
  try {
    logger.log(chalk.blue(`Authenticating with ${registry}...`));

    // Use cross-platform approach: write password to stdin directly
    // This works on Windows, Linux, and macOS
    const { spawn } = require('child_process');
    const dockerLogin = spawn('docker', ['login', registry, '-u', username, '--password-stdin']);

    return new Promise((resolve, reject) => {
      let errorOutput = '';

      dockerLogin.stdin.write(password);
      dockerLogin.stdin.end();

      dockerLogin.stdout.on('data', (_data) => {
        // Authentication output (usually minimal)
      });

      dockerLogin.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      dockerLogin.on('close', (code) => {
        if (code === 0) {
          logger.log(chalk.green(`✓ Authenticated with ${registry}`));
          resolve();
        } else {
          reject(new Error(`Docker login failed: ${errorOutput || `Exit code ${code}`}`));
        }
      });

      dockerLogin.on('error', (error) => {
        reject(new Error(`Failed to execute docker login: ${error.message}`));
      });
    });
  } catch (error) {
    throw new Error(`Failed to authenticate with external registry: ${error.message}`);
  }
}

/**
 * Check if Docker image exists locally
 * @param {string} imageName - Image name
 * @param {string} tag - Image tag (default: latest)
 * @returns {Promise<boolean>} True if image exists
 */
async function checkLocalImageExists(imageName, tag = 'latest') {
  try {
    // Use Docker's native filtering for cross-platform compatibility (Windows-safe)
    const { stdout } = await execAsync(`docker images --format "{{.Repository}}:{{.Tag}}" --filter "reference=${imageName}:${tag}"`);
    const lines = stdout.trim().split('\n').filter(line => line.trim() !== '');
    return lines.some(line => line.trim() === `${imageName}:${tag}`);
  } catch (error) {
    return false;
  }
}

/**
 * Tag Docker image for ACR
 * @param {string} sourceImage - Source image tag
 * @param {string} targetImage - Target image tag
 * @throws {Error} If tagging fails
 */
async function tagImage(sourceImage, targetImage) {
  try {
    logger.log(chalk.blue(`Tagging ${sourceImage} as ${targetImage}...`));
    await execAsync(`docker tag ${sourceImage} ${targetImage}`);
    logger.log(chalk.green(`✓ Tagged: ${targetImage}`));
  } catch (error) {
    throw new Error(`Failed to tag image: ${error.message}`);
  }
}

/**
 * Push Docker image to registry
 * @param {string} imageWithTag - Image with full tag
 * @param {string} registry - Registry URL (for error messages)
 * @throws {Error} If push fails
 */
async function pushImage(imageWithTag, registry = null) {
  try {
    logger.log(chalk.blue(`Pushing ${imageWithTag}...`));
    await execAsync(`docker push ${imageWithTag}`);
    logger.log(chalk.green(`✓ Pushed: ${imageWithTag}`));
  } catch (error) {
    const errorMessage = error.message || error.stderr || String(error);
    const isAuthError = errorMessage.includes('authentication required') ||
                       errorMessage.includes('unauthorized') ||
                       errorMessage.includes('authentication') ||
                       errorMessage.includes('401');

    if (isAuthError && registry) {
      const registryName = extractRegistryName(registry);
      throw new Error(
        `Authentication required for ${registry}.\n` +
        `Run: az acr login --name ${registryName}\n` +
        'Make sure you\'re logged into Azure CLI first: az login'
      );
    }

    throw new Error(`Failed to push image: ${errorMessage}`);
  }
}

module.exports = {
  checkAzureCLIInstalled,
  extractRegistryName,
  validateRegistryURL,
  checkACRAuthentication,
  authenticateACR,
  authenticateExternalRegistry,
  checkLocalImageExists,
  tagImage,
  pushImage
};

