/**
 * Environment port utilities
 *
 * @fileoverview Update container PORT based on variables.yaml and developer-id offset
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const config = require('../core/config');
const { getLocalPort } = require('./port-resolver');

/**
 * Update PORT in the container's .env file to use variables.port (+offset)
 * @function updateContainerPortInEnvFile
 * @param {string} envPath - Path to .env
 * @param {string} variablesPath - Path to variables.yaml
 */
/**
 * Gets developer ID from environment variable or config file
 * @function getDeveloperIdFromEnvOrConfig
 * @returns {number} Developer ID number
 */
function getDeveloperIdFromEnvOrConfig() {
  const devIdRaw = process.env.AIFABRIX_DEVELOPERID;
  if (devIdRaw && /^[0-9]+$/.test(devIdRaw)) {
    return parseInt(devIdRaw, 10);
  }

  try {
    const cfgPath = config && config.CONFIG_FILE ? config.CONFIG_FILE : null;
    if (cfgPath && fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, 'utf8');
      const cfg = yaml.load(cfgContent) || {};
      const raw = cfg['developer-id'];
      if (typeof raw === 'number') {
        return raw;
      }
      if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) {
        return parseInt(raw, 10);
      }
    }
  } catch {
    // ignore, will use 0
  }

  return 0;
}

/**
 * Calculates port with developer ID adjustment
 * @function calculatePortWithDevId
 * @param {number} basePort - Base port
 * @param {number} devIdNum - Developer ID number
 * @returns {number} Adjusted port
 */
function calculatePortWithDevId(basePort, devIdNum) {
  return devIdNum > 0 ? (basePort + devIdNum * 100) : basePort;
}

function updateContainerPortInEnvFile(envPath, variablesPath) {
  if (!fs.existsSync(variablesPath)) {
    return;
  }
  const variablesContent = fs.readFileSync(variablesPath, 'utf8');
  const variables = yaml.load(variablesContent);
  const basePort = getLocalPort(variables, 3000);
  const devIdNum = getDeveloperIdFromEnvOrConfig();
  const port = calculatePortWithDevId(basePort, devIdNum);
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(/^PORT\s*=\s*.*$/m, `PORT=${port}`);
  fs.writeFileSync(envPath, envContent, { mode: 0o600 });
}

module.exports = {
  updateContainerPortInEnvFile
};

