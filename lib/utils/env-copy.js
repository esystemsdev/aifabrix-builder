/**
 * Environment copy and port update utilities
 *
 * @fileoverview Copy .env to app output and apply local/dockerside port rules with dev offsets
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const logger = require('./logger');
const config = require('../core/config');
const devConfig = require('../utils/dev-config');
const { rewriteInfraEndpoints } = require('./env-endpoints');
const { buildEnvVarMap } = require('./env-map');
const { interpolateEnvVars } = require('./secrets-helpers');
const { getLocalPort } = require('./port-resolver');

/**
 * Read developer ID from config file synchronously
 * @param {Object} config - Config object
 * @returns {number|null} Developer ID or null if not found
 */
function readDeveloperIdFromConfig(config) {
  const configPath = config && config.CONFIG_FILE ? config.CONFIG_FILE : null;
  if (!configPath || !fs.existsSync(configPath)) {
    return null;
  }

  try {
    const cfgContent = fs.readFileSync(configPath, 'utf8');
    const cfg = yaml.load(cfgContent) || {};
    const raw = cfg['developer-id'];
    if (typeof raw === 'number') {
      return raw;
    }
    if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) {
      return parseInt(raw, 10);
    }
  } catch {
    // ignore, will fallback to 0
  }

  return null;
}

/**
 * Resolve output path for env file
 * @param {string} rawOutputPath - Raw output path from variables.yaml
 * @param {string} variablesPath - Path to variables.yaml
 * @returns {string} Resolved output path
 */
function resolveEnvOutputPath(rawOutputPath, variablesPath) {
  let outputPath;
  if (path.isAbsolute(rawOutputPath)) {
    outputPath = rawOutputPath;
  } else {
    const variablesDir = path.dirname(variablesPath);
    outputPath = path.resolve(variablesDir, rawOutputPath);
  }
  if (!outputPath.endsWith('.env')) {
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
      outputPath = path.join(outputPath, '.env');
    } else {
      outputPath = path.join(outputPath, '.env');
    }
  }
  return outputPath;
}

/**
 * Calculate developer-specific app port
 * @param {number} baseAppPort - Base application port
 * @returns {number} Developer-specific app port
 */
function calculateDevAppPort(baseAppPort) {
  const devIdRaw = process.env.AIFABRIX_DEVELOPERID;
  let devIdNum = Number.isFinite(parseInt(devIdRaw, 10)) ? parseInt(devIdRaw, 10) : null;
  try {
    if (devIdNum === null) {
      devIdNum = readDeveloperIdFromConfig(config) || 0;
    }
  } catch {
    devIdNum = 0;
  }
  return devIdNum === 0 ? baseAppPort : (baseAppPort + (devIdNum * 100));
}

/**
 * Update PORT in env content
 * @param {string} envContent - Environment file content
 * @param {number} appPort - Application port
 * @returns {string} Updated env content
 */
function updatePortInEnv(envContent, appPort) {
  if (/^PORT\s*=.*$/m.test(envContent)) {
    return envContent.replace(/^PORT\s*=\s*.*$/m, `PORT=${appPort}`);
  }
  return `${envContent}\nPORT=${appPort}\n`;
}

/**
 * Update localhost URLs in env content
 * @param {string} envContent - Environment file content
 * @param {number} baseAppPort - Base application port
 * @param {number} appPort - Developer-specific application port
 * @returns {string} Updated env content
 */
function updateLocalhostUrls(envContent, baseAppPort, appPort) {
  const localhostUrlPattern = /(https?:\/\/localhost:)(\d+)(\b[^ \n]*)?/g;
  return envContent.replace(localhostUrlPattern, (match, prefix, portNum, rest = '') => {
    const num = parseInt(portNum, 10);
    if (num === baseAppPort) {
      return `${prefix}${appPort}${rest || ''}`;
    }
    return match;
  });
}

/**
 * Extract env vars from content for interpolation
 * @param {string} envContent - Environment file content
 * @param {Object} envVars - Existing env vars map
 * @returns {Object} Updated env vars map
 */
/**
 * Extracts a single environment variable from content
 * @function extractSingleEnvVar
 * @param {string} envContent - Environment file content
 * @param {string} varName - Variable name
 * @param {Object} envVars - Environment variables object
 */
function extractSingleEnvVar(envContent, varName, envVars) {
  const pattern = new RegExp(`^${varName}\\s*=\\s*([^\\r\\n$]+)`, 'm');
  const match = envContent.match(pattern);
  if (match && match[1] && !match[1].includes('${')) {
    envVars[varName] = match[1].trim();
  }
}

function extractEnvVarsFromContent(envContent, envVars) {
  extractSingleEnvVar(envContent, 'REDIS_HOST', envVars);
  extractSingleEnvVar(envContent, 'REDIS_PORT', envVars);
  extractSingleEnvVar(envContent, 'DB_HOST', envVars);
  extractSingleEnvVar(envContent, 'DB_PORT', envVars);
  return envVars;
}

/**
 * Patch env content for local development
 * @async
 * @param {string} envContent - Original env content
 * @param {Object} variables - Variables from variables.yaml
 * @returns {Promise<string>} Patched env content
 */
async function patchEnvContentForLocal(envContent, variables) {
  const baseAppPort = getLocalPort(variables, 3000);
  const appPort = calculateDevAppPort(baseAppPort);
  const devIdNum = readDeveloperIdFromConfig(config) || 0;
  const infraPorts = devConfig.getDevPorts(devIdNum);

  // Update PORT
  envContent = updatePortInEnv(envContent, appPort);

  // Update localhost URLs
  envContent = updateLocalhostUrls(envContent, baseAppPort, appPort);

  // Rewrite infra endpoints
  envContent = await rewriteInfraEndpoints(envContent, 'local', infraPorts);

  // Interpolate ${VAR} references
  const envVars = await buildEnvVarMap('local', null, devIdNum);
  const updatedEnvVars = extractEnvVarsFromContent(envContent, envVars);
  envContent = interpolateEnvVars(envContent, updatedEnvVars);

  return envContent;
}

/**
 * Process and optionally copy env file to envOutputPath if configured
 * Regenerates .env file with env=local for local development (apps/.env)
 * @async
 * @function processEnvVariables
 * @param {string} envPath - Path to generated .env file
 * @param {string} variablesPath - Path to variables.yaml
 * @param {string} appName - Application name (for regenerating with local env)
 * @param {string} [secretsPath] - Path to secrets file (optional, for regenerating)
 */
async function processEnvVariables(envPath, variablesPath, appName, secretsPath) {
  if (!fs.existsSync(variablesPath)) {
    return;
  }
  const variablesContent = fs.readFileSync(variablesPath, 'utf8');
  const variables = yaml.load(variablesContent);
  if (!variables?.build?.envOutputPath || variables.build.envOutputPath === null) {
    return;
  }

  // Resolve output path
  const outputPath = resolveEnvOutputPath(variables.build.envOutputPath, variablesPath);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Regenerate .env file with env=local instead of copying docker-generated file
  if (appName) {
    const { generateEnvContent } = require('../core/secrets');
    const localEnvContent = await generateEnvContent(appName, secretsPath, 'local', false);
    fs.writeFileSync(outputPath, localEnvContent, { mode: 0o600 });
    logger.log(chalk.green(`✓ Generated local .env at: ${variables.build.envOutputPath}`));
  } else {
    // Fallback: if appName not provided, use old patching approach
    const envContent = fs.readFileSync(envPath, 'utf8');
    const patchedContent = await patchEnvContentForLocal(envContent, variables);
    fs.writeFileSync(outputPath, patchedContent, { mode: 0o600 });
    logger.log(chalk.green(`✓ Copied .env to: ${variables.build.envOutputPath}`));
  }
}

module.exports = {
  processEnvVariables
};

