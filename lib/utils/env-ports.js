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

/**
 * Update PORT in the container's .env file to use variables.port (+offset)
 * @function updateContainerPortInEnvFile
 * @param {string} envPath - Path to .env
 * @param {string} variablesPath - Path to variables.yaml
 */
function updateContainerPortInEnvFile(envPath, variablesPath) {
  if (!fs.existsSync(variablesPath)) {
    return;
  }
  const variablesContent = fs.readFileSync(variablesPath, 'utf8');
  const variables = yaml.load(variablesContent);
  // Base port from variables
  const basePort = variables?.port || 3000;
  // Determine developer-id (prefer env var for sync context, fallback to config file)
  let devIdNum = 0;
  const devIdRaw = process.env.AIFABRIX_DEVELOPERID;
  if (devIdRaw && /^[0-9]+$/.test(devIdRaw)) {
    devIdNum = parseInt(devIdRaw, 10);
  } else {
    try {
      const cfgPath = config && config.CONFIG_FILE ? config.CONFIG_FILE : null;
      if (cfgPath && fs.existsSync(cfgPath)) {
        const cfgContent = fs.readFileSync(cfgPath, 'utf8');
        const cfg = yaml.load(cfgContent) || {};
        const raw = cfg['developer-id'];
        if (typeof raw === 'number') {
          devIdNum = raw;
        } else if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) {
          devIdNum = parseInt(raw, 10);
        }
      }
    } catch {
      // ignore, will use 0
    }
  }
  const port = devIdNum > 0 ? (basePort + devIdNum * 100) : basePort;
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(/^PORT\s*=\s*.*$/m, `PORT=${port}`);
  fs.writeFileSync(envPath, envContent, { mode: 0o600 });
}

module.exports = {
  updateContainerPortInEnvFile
};

