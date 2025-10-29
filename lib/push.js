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

const execAsync = promisify(exec);

/**
 * Check if Azure CLI is installed
 * @returns {Promise<boolean>} True if Azure CLI is available
 */
async function checkAzureCLIInstalled() {
  try {
    await execAsync('az --version');
    return true;
  } catch (error) {
    return false;
  }
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
 * Validate registry URL format
 * @param {string} registryUrl - Registry URL to validate
 * @returns {boolean} True if valid
 */
function validateRegistryURL(registryUrl) {
  if (!registryUrl || typeof registryUrl !== 'string') {
    return false;
  }

  // Reject protocols
  if (registryUrl.includes('://')) {
    return false;
  }

  // Accept ACR format
  if (/^[^.]+\.azurecr\.io$/.test(registryUrl)) {
    return true;
  }

  // Accept Docker Hub
  if (registryUrl === 'docker.io' || registryUrl === 'index.docker.io') {
    return true;
  }

  // Accept GitHub Container Registry
  if (registryUrl === 'ghcr.io') {
    return true;
  }

  // Reject azurecr.io without subdomain
  if (registryUrl === 'azurecr.io') {
    return false;
  }

  // Reject myacr.azurecr.com (wrong TLD pattern)
  if (/^[^.]+\.azurecr\.com$/.test(registryUrl)) {
    return false;
  }

  // Accept hostname:port format with valid domain
  if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?::[0-9]+)?$/.test(registryUrl)) {
    return true;
  }

  return false;
}

/**
 * Check if already authenticated with ACR
 * @param {string} registry - Registry URL
 * @returns {Promise<boolean>} True if authenticated
 */
async function checkACRAuthentication(registry) {
  try {
    const registryName = extractRegistryName(registry);
    await execAsync(`az acr show --name ${registryName}`);
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
    console.log(chalk.blue(`Authenticating with ${registry}...`));
    await execAsync(`az acr login --name ${registryName}`);
    console.log(chalk.green(`✓ Authenticated with ${registry}`));
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
    console.log(chalk.blue(`Authenticating with ${registry}...`));

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
          console.log(chalk.green(`✓ Authenticated with ${registry}`));
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
    console.log(chalk.blue(`Tagging ${sourceImage} as ${targetImage}...`));
    await execAsync(`docker tag ${sourceImage} ${targetImage}`);
    console.log(chalk.green(`✓ Tagged: ${targetImage}`));
  } catch (error) {
    throw new Error(`Failed to tag image: ${error.message}`);
  }
}

/**
 * Push Docker image to registry
 * @param {string} imageWithTag - Image with full tag
 * @throws {Error} If push fails
 */
async function pushImage(imageWithTag) {
  try {
    console.log(chalk.blue(`Pushing ${imageWithTag}...`));
    await execAsync(`docker push ${imageWithTag}`);
    console.log(chalk.green(`✓ Pushed: ${imageWithTag}`));
  } catch (error) {
    throw new Error(`Failed to push image: ${error.message}`);
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

