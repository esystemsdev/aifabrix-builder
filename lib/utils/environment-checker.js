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
const os = require('os');
const dockerUtils = require('./docker');
const { getActualSecretsPath } = require('./secrets-path');

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
 *
 * @async
 * @function checkPorts
 * @returns {Promise<string>} 'ok' if all ports are available, 'warning' otherwise
 */
async function checkPorts() {
  const requiredPorts = [5432, 6379, 5050, 8081];
  const netstat = require('net');
  let portIssues = 0;

  for (const port of requiredPorts) {
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
    const defaultPath = path.join(os.homedir(), '.aifabrix', 'secrets.yaml');
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

  // Check ports
  result.ports = await checkPorts();
  if (result.ports === 'warning') {
    result.recommendations.push('Some required ports (5432, 6379, 5050, 8081) are in use');
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

