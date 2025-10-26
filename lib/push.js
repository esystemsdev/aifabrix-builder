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
  return /^[^.]+\.azurecr\.io$/.test(registryUrl);
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
 * Check if Docker image exists locally
 * @param {string} imageName - Image name
 * @param {string} tag - Image tag (default: latest)
 * @returns {Promise<boolean>} True if image exists
 */
async function checkLocalImageExists(imageName, tag = 'latest') {
  try {
    const { stdout } = await execAsync(`docker images --format "{{.Repository}}:{{.Tag}}" | grep "^${imageName}:${tag}$"`);
    return stdout.trim() === `${imageName}:${tag}`;
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
  checkLocalImageExists,
  tagImage,
  pushImage
};

