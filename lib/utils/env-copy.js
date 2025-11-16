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
const config = require('../config');
const devConfig = require('../utils/dev-config');
const { rewriteInfraEndpoints } = require('./env-endpoints');

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
  // Resolve output path: absolute stays as-is; relative is resolved against variables.yaml directory
  const rawOutputPath = variables.build.envOutputPath;
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
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Regenerate .env file with env=local instead of copying docker-generated file
  // This ensures all variables use localhost instead of docker service names
  if (appName) {
    const { generateEnvContent } = require('../secrets');
    // Generate local .env content (without writing to builder/.env to avoid overwriting docker version)
    const localEnvContent = await generateEnvContent(appName, secretsPath, 'local', false);
    // Write to output path
    fs.writeFileSync(outputPath, localEnvContent, { mode: 0o600 });
    logger.log(chalk.green(`✓ Generated local .env at: ${variables.build.envOutputPath}`));
  } else {
    // Fallback: if appName not provided, use old patching approach
    let envContent = fs.readFileSync(envPath, 'utf8');
    // Determine base app port and compute developer-specific app port
    const baseAppPort = variables.build?.localPort || variables.port || 3000;
    const devIdRaw = process.env.AIFABRIX_DEVELOPERID;
    // Best effort: parse from env first, otherwise rely on config (may throw if async, so guarded below)
    let devIdNum = Number.isFinite(parseInt(devIdRaw, 10)) ? parseInt(devIdRaw, 10) : null;
    try {
      if (devIdNum === null) {
        // Try to read developer-id from config file synchronously if present
        const configPath = config && config.CONFIG_FILE ? config.CONFIG_FILE : null;
        if (configPath && fs.existsSync(configPath)) {
          try {
            const cfgContent = fs.readFileSync(configPath, 'utf8');
            const cfg = yaml.load(cfgContent) || {};
            const raw = cfg['developer-id'];
            if (typeof raw === 'number') {
              devIdNum = raw;
            } else if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) {
              devIdNum = parseInt(raw, 10);
            }
          } catch {
            // ignore, will fallback to 0
          }
        }
        if (devIdNum === null || Number.isNaN(devIdNum)) {
          devIdNum = 0;
        }
      }
    } catch {
      devIdNum = 0;
    }
    const appPort = devIdNum === 0 ? baseAppPort : (baseAppPort + (devIdNum * 100));
    const infraPorts = devConfig.getDevPorts(devIdNum);

    // Update PORT (replace or append)
    if (/^PORT\s*=.*$/m.test(envContent)) {
      envContent = envContent.replace(/^PORT\s*=\s*.*$/m, `PORT=${appPort}`);
    } else {
      envContent = `${envContent}\nPORT=${appPort}\n`;
    }

    // Update localhost URLs that point to the base app port to the dev-specific app port
    const localhostUrlPattern = /(https?:\/\/localhost:)(\d+)(\b[^ \n]*)?/g;
    envContent = envContent.replace(localhostUrlPattern, (match, prefix, portNum, rest = '') => {
      const num = parseInt(portNum, 10);
      if (num === baseAppPort) {
        return `${prefix}${appPort}${rest || ''}`;
      }
      return match;
    });
    // Rewrite infra endpoints using env-config mapping for local context
    envContent = await rewriteInfraEndpoints(envContent, 'local', infraPorts);
    fs.writeFileSync(outputPath, envContent, { mode: 0o600 });
    logger.log(chalk.green(`✓ Copied .env to: ${variables.build.envOutputPath}`));
  }
}

module.exports = {
  processEnvVariables
};

