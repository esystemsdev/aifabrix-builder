/**
 * Environment Checking Utilities
 *
 * Checks the development environment for common issues
 * Validates Docker, ports, secrets, and other requirements
 *
 * @fileoverview Environment checking utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const dockerUtils = require('./docker');
const { getActualSecretsPath } = require('./secrets-path');
const config = require('../core/config');
const devConfig = require('./dev-config');

/**
 * Checks if Docker is installed and available
 *
 * @async
 * @function checkDocker
 * @returns {Promise<string>} 'ok' if Docker is available, 'error' otherwise
 */
async function checkDocker() {
  try {
    await dockerUtils.checkDockerCli();
    await dockerUtils.getComposeCommand();
    return 'ok';
  } catch (error) {
    return 'error';
  }
}

/**
 * Checks if required ports are available
 * Uses developer-specific ports when developer-id greater than 0 (basePort + developerId * 100)
 *
 * @async
 * @function checkPorts
 * @param {number[]} [requiredPorts] - Ports to check. If omitted, uses ports from config developer-id
 * @returns {Promise<string>} 'ok' if all ports are available, 'warning' otherwise
 */
async function checkPorts(requiredPorts) {
  const netstat = require('net');
  let portsToCheck = requiredPorts;

  if (!portsToCheck || portsToCheck.length === 0) {
    const devId = await config.getDeveloperId();
    const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
    const id = Number.isNaN(idNum) || idNum < 0 ? 0 : idNum;
    const ports = devConfig.getDevPorts(id);
    portsToCheck = [ports.postgres, ports.redis, ports.pgadmin, ports.redisCommander];
  }

  let portIssues = 0;

  for (const port of portsToCheck) {
    try {
      await new Promise((resolve, reject) => {
        const server = netstat.createServer();
        server.listen(port, () => {
          server.close(resolve);
        });
        server.on('error', reject);
      });
    } catch (error) {
      portIssues++;
    }
  }

  return portIssues === 0 ? 'ok' : 'warning';
}

/**
 * Checks if secrets file exists
 * Checks both the default path and the path configured in config.yaml (aifabrix-secrets)
 *
 * @async
 * @function checkSecrets
 * @returns {Promise<Object>} Object with status ('ok' or 'missing') and paths checked
 * @returns {string} returns.status - 'ok' if secrets file exists, 'missing' otherwise
 * @returns {string[]} returns.paths - Array of paths that were checked
 */
async function checkSecrets() {
  try {
    const { userPath, buildPath } = await getActualSecretsPath();
    const pathsChecked = [];

    // Check user path (default: ~/.aifabrix/secrets.local.yaml)
    if (fs.existsSync(userPath)) {
      return { status: 'ok', paths: [userPath] };
    }
    pathsChecked.push(userPath);

    // Check build path (from config.yaml aifabrix-secrets)
    if (buildPath && fs.existsSync(buildPath)) {
      return { status: 'ok', paths: [buildPath] };
    }
    if (buildPath) {
      pathsChecked.push(buildPath);
    }

    return { status: 'missing', paths: pathsChecked };
  } catch (error) {
    // Fallback to default path if there's an error
    const pathsUtil = require('./paths');
    const defaultPath = path.join(pathsUtil.getAifabrixHome(), 'secrets.yaml');
    return {
      status: fs.existsSync(defaultPath) ? 'ok' : 'missing',
      paths: [defaultPath]
    };
  }
}

/**
 * Checks the development environment for common issues
 * Validates Docker, ports, secrets, and other requirements
 *
 * @async
 * @function checkEnvironment
 * @returns {Promise<Object>} Environment check result
 * @throws {Error} If critical issues are found
 *
 * @example
 * const result = await checkEnvironment();
 * // Returns: { docker: 'ok', ports: 'ok', secrets: 'missing', recommendations: [...] }
 */
async function checkEnvironment() {
  const result = {
    docker: 'unknown',
    ports: 'unknown',
    secrets: 'unknown',
    recommendations: []
  };

  // Check Docker
  result.docker = await checkDocker();
  if (result.docker === 'error') {
    result.recommendations.push('Install Docker and Docker Compose');
  }

  // Check ports (developer-specific: dev 0 = base ports, dev N = base + N*100)
  const devId = await config.getDeveloperId();
  const idNum = typeof devId === 'string' ? parseInt(devId, 10) : devId;
  const id = Number.isNaN(idNum) || idNum < 0 ? 0 : idNum;
  const ports = devConfig.getDevPorts(id);
  const requiredPorts = [ports.postgres, ports.redis, ports.pgadmin, ports.redisCommander];

  result.ports = await checkPorts(requiredPorts);
  if (result.ports === 'warning') {
    result.recommendations.push(`Some required ports (${requiredPorts.join(', ')}) are in use`);
  }

  // Check secrets
  const secretsCheck = await checkSecrets();
  result.secrets = secretsCheck.status;
  if (result.secrets === 'missing') {
    // Show the actual paths that were checked
    const pathsList = secretsCheck.paths.map(p => p).join(' or ');
    result.recommendations.push(`Create secrets file: ${pathsList}`);
  }

  return result;
}

module.exports = {
  checkDocker,
  checkPorts,
  checkSecrets,
  checkEnvironment
};

