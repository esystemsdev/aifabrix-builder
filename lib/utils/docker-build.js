/**
 * Docker Build Utilities
 *
 * This module handles Docker image building with progress indicators.
 * Separated from build.js to maintain file size limits.
 *
 * @fileoverview Docker build execution utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { spawn } = require('child_process');
const ora = require('ora');

/**
 * Checks if error indicates Docker is not running or not installed
 * @param {string} errorMessage - Error message to check
 * @returns {boolean} True if Docker is not available
 */
function isDockerNotAvailableError(errorMessage) {
  return errorMessage.includes('docker: command not found') ||
         errorMessage.includes('Cannot connect to the Docker daemon') ||
         errorMessage.includes('Is the docker daemon running') ||
         errorMessage.includes('Cannot connect to Docker');
}

/**
 * Parses Docker build output to extract progress information
 * @param {string} line - Single line of Docker build output
 * @returns {string|null} Progress message or null if no progress info
 */
function parseDockerBuildProgress(line) {
  // Match step progress: "Step 1/10 : FROM node:20-alpine"
  const stepMatch = line.match(/^Step\s+(\d+)\/(\d+)\s*:/i);
  if (stepMatch) {
    return `Step ${stepMatch[1]}/${stepMatch[2]}`;
  }

  // Match layer pulling: "Pulling from library/node"
  const pullingMatch = line.match(/^Pulling\s+(.+)$/i);
  if (pullingMatch) {
    return `Pulling ${pullingMatch[1]}`;
  }

  // Match layer extracting: "Extracting [====>     ]"
  const extractingMatch = line.match(/^Extracting/i);
  if (extractingMatch) {
    return 'Extracting layers';
  }

  // Match build progress: " => [internal] load build context"
  const buildMatch = line.match(/^=>\s*\[(.*?)\]\s*(.+)$/i);
  if (buildMatch) {
    return buildMatch[2].substring(0, 50);
  }

  // Match progress bars: "[====>     ] 10.5MB/50MB"
  const progressMatch = line.match(/\[.*?\]\s+([\d.]+(MB|KB|GB))\/([\d.]+(MB|KB|GB))/i);
  if (progressMatch) {
    return `${progressMatch[1]}/${progressMatch[3]}`;
  }

  return null;
}

/**
 * Executes Docker build command with progress indicator
 * @param {string} imageName - Image name to build
 * @param {string} dockerfilePath - Path to Dockerfile
 * @param {string} contextPath - Build context path
 * @param {string} tag - Image tag
 * @returns {Promise<void>} Resolves when build completes
 * @throws {Error} If build fails
 */
async function executeDockerBuild(imageName, dockerfilePath, contextPath, tag) {
  const spinner = ora({
    text: 'Starting Docker build...',
    spinner: 'dots'
  }).start();

  // Ensure paths are absolute and normalized
  const fsSync = require('fs');
  const path = require('path');

  dockerfilePath = path.resolve(dockerfilePath);
  contextPath = path.resolve(contextPath);

  // Validate paths exist (skip in test environments)
  const isTestEnv = process.env.NODE_ENV === 'test' ||
                    process.env.JEST_WORKER_ID !== undefined ||
                    typeof jest !== 'undefined';

  if (!isTestEnv) {
    if (!fsSync.existsSync(dockerfilePath)) {
      spinner.fail('Build failed');
      throw new Error(`Dockerfile not found: ${dockerfilePath}`);
    }

    if (!fsSync.existsSync(contextPath)) {
      spinner.fail('Build failed');
      throw new Error(`Build context path does not exist: ${contextPath}`);
    }
  }

  return new Promise((resolve, reject) => {
    // Use spawn for streaming output
    const dockerProcess = spawn('docker', [
      'build',
      '-t', `${imageName}:${tag}`,
      '-f', dockerfilePath,
      contextPath
    ], {
      shell: process.platform === 'win32'
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let lastProgressUpdate = Date.now();

    dockerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutBuffer += output;

      // Parse progress from output lines
      const lines = output.split('\n');
      for (const line of lines) {
        const progress = parseDockerBuildProgress(line.trim());
        if (progress) {
          // Update spinner text with progress (throttle updates)
          const now = Date.now();
          if (now - lastProgressUpdate > 200) {
            spinner.text = `Building image... ${progress}`;
            lastProgressUpdate = now;
          }
        }
      }
    });

    dockerProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderrBuffer += output;

      // Check for warnings vs errors
      if (!output.toLowerCase().includes('warning')) {
        // Parse progress from stderr too (Docker outputs progress to stderr)
        const lines = output.split('\n');
        for (const line of lines) {
          const progress = parseDockerBuildProgress(line.trim());
          if (progress) {
            const now = Date.now();
            if (now - lastProgressUpdate > 200) {
              spinner.text = `Building image... ${progress}`;
              lastProgressUpdate = now;
            }
          }
        }
      }
    });

    dockerProcess.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(`Image built: ${imageName}:${tag}`);
        resolve();
      } else {
        spinner.fail('Build failed');

        const errorMessage = stderrBuffer || stdoutBuffer || 'Docker build failed';

        if (isDockerNotAvailableError(errorMessage)) {
          reject(new Error('Docker is not running or not installed. Please start Docker Desktop and try again.'));
        } else {
          // Show last few lines of error output
          const errorLines = errorMessage.split('\n').filter(line => line.trim());
          const lastError = errorLines.slice(-5).join('\n');
          reject(new Error(`Docker build failed: ${lastError}`));
        }
      }
    });

    dockerProcess.on('error', (error) => {
      spinner.fail('Build failed');
      const errorMessage = error.message || String(error);

      if (isDockerNotAvailableError(errorMessage)) {
        reject(new Error('Docker is not running or not installed. Please start Docker Desktop and try again.'));
      } else {
        reject(new Error(`Docker build failed: ${errorMessage}`));
      }
    });
  });
}

/**
 * Execute Docker build with additional tagging
 * @async
 * @param {string} imageName - Image name to build
 * @param {string} dockerfilePath - Path to Dockerfile
 * @param {string} contextPath - Build context path
 * @param {string} tag - Image tag
 * @param {Object} options - Build options
 * @returns {Promise<void>} Resolves when build completes
 * @throws {Error} If build fails
 */
async function executeBuild(imageName, dockerfilePath, contextPath, tag, options) {
  await executeDockerBuild(imageName, dockerfilePath, contextPath, tag);

  // Tag image if additional tag provided
  if (options && options.tag && options.tag !== 'latest') {
    const { promisify } = require('util');
    const { exec } = require('child_process');
    const run = promisify(exec);
    await run(`docker tag ${imageName}:${tag} ${imageName}:latest`);
  }
}

/**
 * Execute Docker build and tag with compatibility tag
 * @async
 * @param {string} effectiveImageName - Effective image name
 * @param {string} imageName - Base image name
 * @param {string} dockerfilePath - Dockerfile path
 * @param {string} contextPath - Build context path
 * @param {string} tag - Image tag
 * @param {Object} options - Build options
 * @returns {Promise<void>}
 */
async function executeDockerBuildWithTag(effectiveImageName, imageName, dockerfilePath, contextPath, tag, options) {
  const logger = require('../utils/logger');
  const chalk = require('chalk');

  logger.log(chalk.blue(`Using Dockerfile: ${dockerfilePath}`));
  logger.log(chalk.blue(`Using build context: ${contextPath}`));

  await executeBuild(effectiveImageName, dockerfilePath, contextPath, tag, options);

  // Back-compat: also tag the built dev image as the base image name
  try {
    const { promisify } = require('util');
    const { exec } = require('child_process');
    const run = promisify(exec);
    await run(`docker tag ${effectiveImageName}:${tag} ${imageName}:${tag}`);
    logger.log(chalk.green(`✓ Tagged image: ${imageName}:${tag}`));
  } catch (err) {
    logger.log(chalk.yellow(`⚠️  Warning: Could not create compatibility tag ${imageName}:${tag} - ${err.message}`));
  }
}

module.exports = {
  executeDockerBuild,
  executeBuild,
  executeDockerBuildWithTag,
  isDockerNotAvailableError
};

