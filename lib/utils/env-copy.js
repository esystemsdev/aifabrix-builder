/**
 * Environment copy and port update utilities
 *
 * @fileoverview Copy .env to app output and apply local/dockerside port rules with dev offsets
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
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
 * Substitute /mnt/data with local mount path for local .env and ensure mount dir exists on disk.
 * Creates the mount folder on the local filesystem (next to the .env file) when it does not exist.
 * @param {string} content - Env file content
 * @param {string} outputPath - Resolved path of the .env file being written
 * @returns {string} Content with /mnt/data replaced by path to mount directory
 */
function substituteMntDataForLocal(content, outputPath) {
  const outputDir = path.dirname(outputPath);
  const localMountPath = path.resolve(outputDir, 'mount');
  if (!fs.existsSync(localMountPath)) {
    fs.mkdirSync(localMountPath, { recursive: true });
  }
  return content.replace(/\/mnt\/data/g, localMountPath);
}

/**
 * Resolve output path for env file
 * @param {string} rawOutputPath - Raw output path from application config
 * @param {string} variablesPath - Path to application config
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
 * Writes .env to envOutputPath for reload path: merge run .env into existing file.
 * @async
 * @param {string} outputPath - Resolved output path
 * @param {string} runEnvPath - Path to .env.run
 */
async function writeEnvOutputForReload(outputPath, runEnvPath) {
  const { parseEnvContentToMap, mergeEnvMapIntoContent } = require('../core/secrets');
  const runContent = await fsp.readFile(runEnvPath, 'utf8');
  const runMap = parseEnvContentToMap(runContent);
  let toWrite = runContent;
  if (fs.existsSync(outputPath)) {
    const existingContent = await fsp.readFile(outputPath, 'utf8');
    toWrite = mergeEnvMapIntoContent(existingContent, runMap);
  }
  await fsp.writeFile(outputPath, toWrite, { mode: 0o600 });
  logger.log(chalk.green(`✓ Wrote .env to envOutputPath (same as container, for --reload): ${outputPath}`));
}

/**
 * Writes local .env to envOutputPath (no reload).
 * @async
 * @param {string} appName - Application name
 * @param {string} outputPath - Resolved output path
 */
async function writeEnvOutputForLocal(appName, outputPath) {
  const { generateEnvContent, parseEnvContentToMap, mergeEnvMapIntoContent } = require('../core/secrets');
  let localContent = await generateEnvContent(appName, null, 'local', false);
  localContent = substituteMntDataForLocal(localContent, outputPath);
  let toWrite = localContent;
  if (fs.existsSync(outputPath)) {
    const existingContent = await fsp.readFile(outputPath, 'utf8');
    const localMap = parseEnvContentToMap(localContent);
    toWrite = mergeEnvMapIntoContent(existingContent, localMap);
  }
  await fsp.writeFile(outputPath, toWrite, { mode: 0o600 });
  logger.log(chalk.green(`✓ Wrote .env to envOutputPath (localPort): ${outputPath}`));
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
 * @param {Object} variables - Variables from application config
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
 * Write regenerated local .env to output path (merge with existing if present).
 * @async
 * @param {string} outputPath - Resolved output path
 * @param {string} appName - Application name
 * @param {string} [secretsPath] - Path to secrets file (optional)
 * @param {string} envOutputPathLabel - Label for log message (e.g. variables.build.envOutputPath)
 */
async function writeLocalEnvToOutputPath(outputPath, appName, secretsPath, envOutputPathLabel) {
  const { generateEnvContent, parseEnvContentToMap, mergeEnvMapIntoContent } = require('../core/secrets');
  let localEnvContent = await generateEnvContent(appName, secretsPath, 'local', false);
  localEnvContent = substituteMntDataForLocal(localEnvContent, outputPath);
  let toWrite = localEnvContent;
  if (fs.existsSync(outputPath)) {
    const existingContent = fs.readFileSync(outputPath, 'utf8');
    const localMap = parseEnvContentToMap(localEnvContent);
    toWrite = mergeEnvMapIntoContent(existingContent, localMap);
  }
  fs.writeFileSync(outputPath, toWrite, { mode: 0o600 });
  logger.log(chalk.green(`✓ Generated local .env at: ${envOutputPathLabel}`));
}

/**
 * Write patched .env to output path (fallback when appName not provided).
 * @async
 * @param {string} envPath - Path to generated .env file
 * @param {string} outputPath - Resolved output path
 * @param {Object} variables - Loaded variables config
 * @param {string} envOutputPathLabel - Label for log message
 */
async function writePatchedEnvToOutputPath(envPath, outputPath, variables, envOutputPathLabel) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  let patchedContent = await patchEnvContentForLocal(envContent, variables);
  patchedContent = substituteMntDataForLocal(patchedContent, outputPath);
  fs.writeFileSync(outputPath, patchedContent, { mode: 0o600 });
  logger.log(chalk.green(`✓ Copied .env to: ${envOutputPathLabel}`));
}

/**
 * Process and optionally copy env file to envOutputPath if configured
 * Regenerates .env file with env=local for local development (apps/.env)
 * @async
 * @function processEnvVariables
 * @param {string} envPath - Path to generated .env file
 * @param {string} variablesPath - Path to application config
 * @param {string} appName - Application name (for regenerating with local env)
 * @param {string} [secretsPath] - Path to secrets file (optional, for regenerating)
 */
async function processEnvVariables(envPath, variablesPath, appName, secretsPath) {
  if (!variablesPath || !fs.existsSync(variablesPath)) {
    return;
  }
  const variablesContent = fs.readFileSync(variablesPath, 'utf8');
  const variables = yaml.load(variablesContent);
  if (!variables?.build?.envOutputPath || variables.build.envOutputPath === null) {
    return;
  }

  const outputPath = resolveEnvOutputPath(variables.build.envOutputPath, variablesPath);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const label = variables.build.envOutputPath;
  if (appName) {
    await writeLocalEnvToOutputPath(outputPath, appName, secretsPath, label);
  } else {
    await writePatchedEnvToOutputPath(envPath, outputPath, variables, label);
  }
}

module.exports = {
  processEnvVariables,
  resolveEnvOutputPath,
  substituteMntDataForLocal,
  writeEnvOutputForReload,
  writeEnvOutputForLocal
};

