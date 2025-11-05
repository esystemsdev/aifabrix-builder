/**
 * Integration Test Utilities
 * Common utilities for integration tests
 *
 * @fileoverview Shared functions for integration test suite
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

const execAsync = promisify(exec);

/**
 * Execute a CLI command and return result
 * @async
 * @function execCommand
 * @param {string} command - Command to execute
 * @param {number} [timeout=30000] - Command timeout in milliseconds
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>} Command result
 */
async function execCommand(command, timeout = 30000) {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout });
    return {
      exitCode: 0,
      stdout: stdout || '',
      stderr: stderr || ''
    };
  } catch (error) {
    return {
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || ''
    };
  }
}

/**
 * Test if app directories exist
 * @async
 * @function testAppExists
 * @param {string} appName - Application name
 * @returns {Promise<{builder: boolean, apps: boolean, builderPath: string, appsPath: string}>} App existence info
 */
async function testAppExists(appName) {
  const builderPath = path.join(process.cwd(), 'builder', appName);
  const appsPath = path.join(process.cwd(), 'apps', appName);

  try {
    const builderExists = await fs.access(builderPath).then(() => true).catch(() => false);
    const appsExists = await fs.access(appsPath).then(() => true).catch(() => false);

    return {
      builder: builderExists,
      apps: appsExists,
      builderPath,
      appsPath
    };
  } catch (error) {
    return {
      builder: false,
      apps: false,
      builderPath,
      appsPath
    };
  }
}

/**
 * Test if file exists
 * @async
 * @function testFileExists
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function testFileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Test if Docker is running
 * @async
 * @function testDockerRunning
 * @returns {Promise<boolean>} True if Docker is running
 */
async function testDockerRunning() {
  // First check if docker command exists
  const dockerCmdCheck = await execCommand('docker --version', 5000);
  if (dockerCmdCheck.exitCode !== 0) {
    return false;
  }

  // Then check if Docker daemon is accessible
  const dockerDaemonCheck = await execCommand('docker info', 10000);
  return dockerDaemonCheck.exitCode === 0;
}

/**
 * Test if infrastructure is running
 * @async
 * @function testInfrastructureRunning
 * @returns {Promise<boolean>} True if infrastructure is running
 */
async function testInfrastructureRunning() {
  const result = await execCommand('aifabrix status', 10000);
  return result.exitCode === 0;
}

/**
 * Test if container is running
 * @async
 * @function testContainerRunning
 * @param {string} containerName - Container name to check
 * @returns {Promise<boolean>} True if container is running
 */
async function testContainerRunning(containerName) {
  const result = await execCommand(`docker ps --filter "name=${containerName}" --format "{{.Names}}"`, 5000);
  return result.stdout.trim().includes(containerName);
}

/**
 * Test if database exists
 * @async
 * @function testDatabaseExists
 * @param {string} databaseName - Database name to check
 * @param {string} [containerName='aifabrix-postgres'] - PostgreSQL container name
 * @returns {Promise<boolean>} True if database exists
 */
async function testDatabaseExists(databaseName, containerName = 'aifabrix-postgres') {
  const command = `docker exec ${containerName} psql -U pgadmin -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${databaseName}'"`;
  const result = await execCommand(command, 10000);
  return result.exitCode === 0 && result.stdout.trim().includes('1');
}

/**
 * Test if database user exists
 * @async
 * @function testDatabaseUserExists
 * @param {string} userName - Database user name to check
 * @param {string} [containerName='aifabrix-postgres'] - PostgreSQL container name
 * @returns {Promise<boolean>} True if user exists
 */
async function testDatabaseUserExists(userName, containerName = 'aifabrix-postgres') {
  const command = `docker exec ${containerName} psql -U pgadmin -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='${userName}'"`;
  const result = await execCommand(command, 10000);
  return result.exitCode === 0 && result.stdout.trim().includes('1');
}

/**
 * Test database connection from container
 * @async
 * @function testDatabaseConnection
 * @param {string} containerName - Container name to test from
 * @param {string} host - Database host
 * @param {string} port - Database port
 * @param {string} database - Database name
 * @param {string} user - Database user
 * @param {string} password - Database password
 * @returns {Promise<boolean>} True if connection successful
 */
async function testDatabaseConnection(containerName, host, port, database, user, password) {
  const dbNameUnderscore = database.replace(/-/g, '_');
  const command = `PGPASSWORD='${password}' psql -h ${host} -p ${port} -U ${user} -d ${dbNameUnderscore} -c 'SELECT 1;'`;
  const fullCommand = `docker exec ${containerName} sh -c "${command}"`;
  const result = await execCommand(fullCommand, 10000);
  return result.exitCode === 0 && result.stdout.includes('1');
}

/**
 * Get health check response from HTTP endpoint
 * @async
 * @function getHealthCheckResponse
 * @param {string} [url='http://localhost:3090/health'] - Health check URL
 * @param {number} [timeoutSec=5] - Timeout in seconds
 * @returns {Promise<{success: boolean, status: string, content: object|null, error: string|null}>} Health check response
 */
function getHealthCheckResponse(url = 'http://localhost:3090/health', timeoutSec = 5) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: timeoutSec * 1000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const content = JSON.parse(data);
          resolve({
            success: res.statusCode === 200,
            status: content.status || 'unknown',
            content,
            error: null
          });
        } catch {
          resolve({
            success: false,
            status: 'error',
            content: null,
            error: 'Invalid JSON response'
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        status: 'error',
        content: null,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        status: 'error',
        content: null,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

/**
 * Get default app name for language
 * @function getLanguageAppName
 * @param {string} language - Language ('python' or 'typescript')
 * @returns {string} Default app name
 */
function getLanguageAppName(language) {
  switch (language.toLowerCase()) {
  case 'python':
    return 'test-py-app';
  case 'typescript':
    return 'test-ts-app';
  default:
    return 'test-py-app';
  }
}

/**
 * Get default port for language
 * @function getLanguagePort
 * @param {string} language - Language ('python' or 'typescript')
 * @returns {number} Default port
 */
function getLanguagePort(language) {
  switch (language.toLowerCase()) {
  case 'python':
    return 3090;
  case 'typescript':
    return 3091;
  default:
    return 3090;
  }
}

/**
 * Get expected source files for language
 * @function getLanguageFiles
 * @param {string} language - Language ('python' or 'typescript')
 * @returns {{sourceFiles: string[], sourceFileNames: string[]}} Expected files
 */
function getLanguageFiles(language) {
  switch (language.toLowerCase()) {
  case 'python':
    return {
      sourceFiles: ['requirements.txt', 'main.py'],
      sourceFileNames: ['requirements.txt', 'main.py']
    };
  case 'typescript':
    return {
      sourceFiles: ['package.json', 'index.ts'],
      sourceFileNames: ['package.json', 'index.ts']
    };
  default:
    return {
      sourceFiles: ['requirements.txt', 'main.py'],
      sourceFileNames: ['requirements.txt', 'main.py']
    };
  }
}

/**
 * Get expected Dockerfile pattern for language
 * @function getLanguageDockerfilePattern
 * @param {string} language - Language ('python' or 'typescript')
 * @returns {string} Expected Dockerfile pattern
 */
function getLanguageDockerfilePattern(language) {
  switch (language.toLowerCase()) {
  case 'python':
    return 'FROM python';
  case 'typescript':
    return 'FROM node';
  default:
    return 'FROM python';
  }
}

/**
 * Convert app name to database name format (hyphens to underscores)
 * @function convertAppNameToDbName
 * @param {string} appName - Application name
 * @returns {string} Database name
 */
function convertAppNameToDbName(appName) {
  return appName.replace(/-/g, '_');
}

/**
 * Clean up app directories and containers
 * @async
 * @function cleanupApp
 * @param {string} appName - Application name to clean up
 * @returns {Promise<void>}
 */
async function cleanupApp(appName) {
  try {
    // Stop and remove container if running
    const containerName = `aifabrix-${appName}`;
    if (await testContainerRunning(containerName)) {
      await execCommand(`docker stop ${containerName}`, 10000);
      await execCommand(`docker rm ${containerName}`, 10000);
    }

    // Remove app directories
    const appInfo = await testAppExists(appName);
    if (appInfo.builder) {
      await fs.rm(appInfo.builderPath, { recursive: true, force: true });
    }
    if (appInfo.apps) {
      await fs.rm(appInfo.appsPath, { recursive: true, force: true });
    }
  } catch (error) {
    // Ignore cleanup errors
    console.warn(`Cleanup warning: ${error.message}`);
  }
}

/**
 * Sleep for specified milliseconds
 * @async
 * @function sleep
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  execCommand,
  testAppExists,
  testFileExists,
  testDockerRunning,
  testInfrastructureRunning,
  testContainerRunning,
  testDatabaseExists,
  testDatabaseUserExists,
  testDatabaseConnection,
  getHealthCheckResponse,
  getLanguageAppName,
  getLanguagePort,
  getLanguageFiles,
  getLanguageDockerfilePattern,
  convertAppNameToDbName,
  cleanupApp,
  sleep
};

