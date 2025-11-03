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

/**
 * Checks if Docker is installed and available
 *
 * @async
 * @function checkDocker
 * @returns {Promise<string>} 'ok' if Docker is available, 'error' otherwise
 */
async function checkDocker() {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    await execAsync('docker --version');
    await execAsync('docker-compose --version');
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
 *
 * @function checkSecrets
 * @returns {string} 'ok' if secrets file exists, 'missing' otherwise
 */
function checkSecrets() {
  const secretsPath = path.join(os.homedir(), '.aifabrix', 'secrets.yaml');
  return fs.existsSync(secretsPath) ? 'ok' : 'missing';
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
  result.secrets = checkSecrets();
  if (result.secrets === 'missing') {
    result.recommendations.push('Create secrets file: ~/.aifabrix/secrets.yaml');
  }

  return result;
}

module.exports = {
  checkDocker,
  checkPorts,
  checkSecrets,
  checkEnvironment
};

