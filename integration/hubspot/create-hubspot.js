#!/usr/bin/env node
/* eslint-disable max-lines */
/**
 * HubSpot Integration Creation Helper Script
 *
 * Creates a new HubSpot integration using the wizard and prepares files for manual editing
 *
 * @fileoverview Helper script for creating HubSpot integrations
 * @author AI Fabrix Team
 * @version 2.0.0
 */
'use strict';

const fs = require('fs').promises;
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const yaml = require('js-yaml');
const chalk = require('chalk');
const logger = require('../../lib/utils/logger');

const execFileAsync = promisify(execFile);

const DEFAULT_CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://localhost:3110';
const DEFAULT_ENVIRONMENT = process.env.ENVIRONMENT || 'miso';
const DEFAULT_OPENAPI_FILE = process.env.HUBSPOT_OPENAPI_FILE ||
  path.join(process.cwd(), 'integration', 'hubspot', 'companies.json');

/**
 * Prints usage information
 * @function printUsage
 * @returns {void}
 */
function printUsage() {
  logger.log([
    'Usage:',
    '  node integration/hubspot/create-hubspot.js [options]',
    '',
    'Options:',
    '  --name <name>              Application name (required)',
    '  --openapi <path>           Path to OpenAPI file (default: env HUBSPOT_OPENAPI_FILE)',
    '  --output <dir>             Output directory for files (default: integration/<name>)',
    '  --controller <url>         Controller URL (default: env CONTROLLER_URL)',
    '  --environment <env>        Environment name (default: env ENVIRONMENT)',
    '  --dataplane <url>          Dataplane URL (optional, will be auto-discovered)',
    '  --keep-wizard-files        Keep wizard-generated files in integration/ directory',
    '  --help                     Show this help message',
    '',
    'Examples:',
    '  node integration/hubspot/create-hubspot.js --name my-hubspot',
    '  node integration/hubspot/create-hubspot.js --name my-hubspot --output ~/my-project',
    '  node integration/hubspot/create-hubspot.js --name my-hubspot --openapi /path/to/openapi.json'
  ].join('\n'));
}

/**
 * Parses command line arguments
 * @function parseArgs
 * @param {string[]} argv - Command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs(argv) {
  const args = {
    name: null,
    openapi: DEFAULT_OPENAPI_FILE,
    output: null,
    controller: DEFAULT_CONTROLLER_URL,
    environment: DEFAULT_ENVIRONMENT,
    dataplane: process.env.DATAPLANE_URL || null,
    keepWizardFiles: false,
    help: false
  };

  const flagMap = {
    '--name': 'name',
    '--openapi': 'openapi',
    '--output': 'output',
    '--controller': 'controller',
    '--environment': 'environment',
    '--dataplane': 'dataplane'
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const argKey = flagMap[arg];

    if (argKey && argv[i + 1]) {
      args[argKey] = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--keep-wizard-files') {
      args.keepWizardFiles = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

/**
 * Logs info message
 * @function logInfo
 * @param {string} message - Message to log
 * @returns {void}
 */
function logInfo(message) {
  logger.log(chalk.cyan(message));
}

/**
 * Logs success message
 * @function logSuccess
 * @param {string} message - Message to log
 * @returns {void}
 */
function logSuccess(message) {
  logger.log(chalk.green(message));
}

/**
 * Logs error message
 * @function logError
 * @param {string} message - Message to log
 * @returns {void}
 */
function logError(message) {
  logger.error(chalk.red(message));
}

/**
 * Checks if file exists
 * @async
 * @function fileExists
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures directory exists
 * @async
 * @function ensureDir
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>} Resolves when directory is created
 */
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Creates wizard configuration file
 * @async
 * @function createWizardConfig
 * @param {string} appName - Application name
 * @param {string} openapiFile - OpenAPI file path
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment name
 * @returns {Promise<string>} Path to created config file
 */
async function createWizardConfig(appName, openapiFile, controllerUrl, environment) {
  const configDir = path.join(process.cwd(), 'integration', 'hubspot');
  await ensureDir(configDir);
  const configPath = path.join(configDir, `wizard-${appName}.yaml`);

  const config = {
    appName,
    mode: 'create-system',
    source: {
      type: 'openapi-file',
      filePath: openapiFile
    },
    credential: {
      action: 'skip'
    },
    preferences: {
      intent: `HubSpot CRM integration for ${appName}`,
      fieldOnboardingLevel: 'full',
      enableOpenAPIGeneration: true,
      enableABAC: true,
      enableRBAC: false
    },
    deployment: {
      controller: controllerUrl,
      environment
    }
  };

  const yamlContent = yaml.dump(config, { lineWidth: -1, noRefs: true });
  await fs.writeFile(configPath, yamlContent, 'utf8');
  return configPath;
}

/**
 * Tests a single endpoint for reachability
 * @async
 * @function testEndpoint
 * @param {string} testUrl - URL to test
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<boolean>} True if endpoint is reachable
 */
async function testEndpoint(testUrl, timeoutMs) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await Promise.race([
      fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]).catch(() => null);

    clearTimeout(timeoutId);

    // If we get any response (even 404 or 401), the service is reachable
    // 401 is OK because it means the API is working, just needs auth
    if (response && (response.ok || response.status === 404 || response.status === 401)) {
      return true;
    }

    // If we get a 500 or other server error, the service is up but broken
    // Still consider it "reachable" - the wizard will handle the actual error
    return response && response.status >= 500;
  } catch (error) {
    // Timeout or abort means endpoint is not reachable
    return false;
  }
}

/**
 * Checks if dataplane URL is reachable and API is functional
 * @async
 * @function checkDataplaneHealth
 * @param {string} dataplaneUrl - Dataplane URL to check
 * @param {number} timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns {Promise<boolean>} True if dataplane is reachable and functional
 */
async function checkDataplaneHealth(dataplaneUrl, timeoutMs = 5000) {
  if (!dataplaneUrl) {
    return false;
  }

  const baseUrl = dataplaneUrl.replace(/\/$/, '');
  const endpointsToTest = ['/health', '/api/v1/health', '/api/health', ''];

  for (const endpoint of endpointsToTest) {
    const testUrl = endpoint ? `${baseUrl}${endpoint}` : baseUrl;
    const isReachable = await testEndpoint(testUrl, timeoutMs);
    if (isReachable) {
      return true;
    }
  }

  return false;
}

/**
 * Validates dataplane health before running wizard
 * @async
 * @function validateDataplaneHealth
 * @param {string} dataplaneUrl - Dataplane URL to check
 * @returns {Promise<Object|null>} Error object if unhealthy, null if healthy
 */
async function validateDataplaneHealth(dataplaneUrl) {
  logInfo('Checking dataplane connectivity...');
  try {
    const isHealthy = await checkDataplaneHealth(dataplaneUrl, 5000);
    if (!isHealthy) {
      return {
        success: false,
        stdout: '',
        stderr: '',
        error: `Dataplane is not reachable at ${dataplaneUrl}.\n\n` +
               'Please ensure the dataplane service is running and accessible, then try again.\n' +
               `You can check dataplane status with: curl ${dataplaneUrl}/health`
      };
    }
    logSuccess('✓ Dataplane is reachable');
    return null;
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: '',
      error: `Failed to check dataplane health: ${error.message}\n\n` +
             `The dataplane at ${dataplaneUrl} may be down or unreachable.`
    };
  }
}

/**
 * Builds wizard command arguments
 * @function buildWizardArgs
 * @param {string} configPath - Path to wizard config file
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment name
 * @param {string|null} dataplaneUrl - Optional dataplane URL
 * @returns {string[]} Command arguments
 */
function buildWizardArgs(configPath, controllerUrl, environment, dataplaneUrl) {
  const args = [
    'bin/aifabrix.js',
    'wizard',
    '--config',
    configPath,
    '--controller',
    controllerUrl,
    '--environment',
    environment
  ];

  if (dataplaneUrl) {
    args.push('--dataplane', dataplaneUrl);
  }

  return args;
}

/**
 * Handles wizard command execution errors
 * @function handleWizardError
 * @param {Error} error - Error object
 * @param {string|null} dataplaneUrl - Dataplane URL
 * @returns {Object} Error result object
 */
function handleWizardError(error, dataplaneUrl) {
  const baseResult = {
    success: false,
    stdout: error.stdout || '',
    stderr: error.stderr || ''
  };

  // Check for timeout
  if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
    const dataplaneInfo = dataplaneUrl ? `dataplane at ${dataplaneUrl}` : 'dataplane (auto-discovered)';
    return {
      ...baseResult,
      error: `Wizard command timed out after 2 minutes. This usually indicates the ${dataplaneInfo} is down or unreachable.\n\n` +
             'Please ensure the dataplane service is running and accessible, then try again.'
    };
  }

  // Check for connection errors
  const errorOutput = (error.stdout || '') + (error.stderr || '') + (error.message || '');
  const lowerOutput = errorOutput.toLowerCase();
  const isConnectionError = lowerOutput.includes('dataplane') ||
    lowerOutput.includes('connection') ||
    lowerOutput.includes('timeout') ||
    lowerOutput.includes('econnrefused');

  if (isConnectionError) {
    return {
      ...baseResult,
      error: `Wizard failed: ${error.message}\n\nThis may be due to dataplane connectivity issues. Ensure the dataplane service is running at ${dataplaneUrl || 'the discovered URL'}.`
    };
  }

  return { ...baseResult, error: error.message };
}

/**
 * Runs wizard command
 * @async
 * @function runWizard
 * @param {string} configPath - Path to wizard config file
 * @param {string} controllerUrl - Controller URL
 * @param {string} environment - Environment name
 * @param {string|null} dataplaneUrl - Optional dataplane URL
 * @returns {Promise<Object>} Command result object
 */
async function runWizard(configPath, controllerUrl, environment, dataplaneUrl) {
  if (dataplaneUrl) {
    const healthError = await validateDataplaneHealth(dataplaneUrl);
    if (healthError) {
      return healthError;
    }
  } else {
    logInfo('Note: No dataplane URL provided. Wizard will attempt to discover it from controller.');
    logInfo('If dataplane discovery fails or hangs, provide --dataplane <url> explicitly.');
  }

  const args = buildWizardArgs(configPath, controllerUrl, environment, dataplaneUrl);

  try {
    const result = await execFileAsync('node', args, {
      cwd: process.cwd(),
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024,
      timeout: 2 * 60 * 1000
    });
    return { success: true, stdout: result.stdout || '', stderr: result.stderr || '' };
  } catch (error) {
    return handleWizardError(error, dataplaneUrl);
  }
}

/**
 * Lists files in directory
 * @async
 * @function listFiles
 * @param {string} dirPath - Directory path
 * @returns {Promise<string[]>} Array of file names
 */
async function listFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name);
  } catch {
    return [];
  }
}

/**
 * Copies file
 * @async
 * @function copyFile
 * @param {string} src - Source file path
 * @param {string} dest - Destination file path
 * @returns {Promise<void>} Resolves when file is copied
 */
async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

/**
 * Copies directory contents
 * @async
 * @function copyDirectoryContents
 * @param {string} srcDir - Source directory
 * @param {string} destDir - Destination directory
 * @param {string[]} filePatterns - File patterns to match (e.g., ['*.json', '*.yaml'])
 * @returns {Promise<string[]>} Array of copied file names
 */
async function copyDirectoryContents(srcDir, destDir, filePatterns = null) {
  await ensureDir(destDir);
  const files = await listFiles(srcDir);
  const copiedFiles = [];

  for (const fileName of files) {
    // Filter by patterns if provided
    if (filePatterns) {
      const matches = filePatterns.some(pattern => {
        if (pattern.startsWith('*.')) {
          const ext = pattern.slice(1);
          return fileName.endsWith(ext);
        }
        return fileName.includes(pattern);
      });
      if (!matches) {
        continue;
      }
    }

    const srcPath = path.join(srcDir, fileName);
    const destPath = path.join(destDir, fileName);
    await copyFile(srcPath, destPath);
    copiedFiles.push(fileName);
  }

  return copiedFiles;
}

/**
 * Validates command line arguments
 * @function validateArgs
 * @param {Object} args - Parsed arguments
 * @returns {void}
 * @throws {Error} If validation fails
 */
function validateArgs(args) {
  if (!args.name) {
    throw new Error('--name is required');
  }

  if (!/^[a-z0-9-_]+$/.test(args.name)) {
    throw new Error('App name must contain only lowercase letters, numbers, hyphens, and underscores');
  }
}

/**
 * Validates OpenAPI file exists
 * @async
 * @function validateOpenApiFile
 * @param {string} openapiPath - OpenAPI file path
 * @returns {Promise<void>} Resolves if file exists
 * @throws {Error} If file doesn't exist
 */
async function validateOpenApiFile(openapiPath) {
  if (!(await fileExists(openapiPath))) {
    throw new Error(`OpenAPI file not found: ${openapiPath}`);
  }
}

/**
 * Handles wizard execution
 * @async
 * @function executeWizard
 * @param {Object} args - Parsed arguments
 * @returns {Promise<string>} Path to wizard config file
 */
async function executeWizard(args) {
  logInfo('\n1. Creating wizard configuration...');
  const configPath = await createWizardConfig(
    args.name,
    args.openapi,
    args.controller,
    args.environment
  );
  logSuccess(`✓ Created config: ${configPath}`);

  logInfo('\n2. Running wizard...');
  const wizardResult = await runWizard(
    configPath,
    args.controller,
    args.environment,
    args.dataplane
  );

  if (!wizardResult.success) {
    logError('Wizard failed:');
    if (wizardResult.stdout) {
      logger.log(wizardResult.stdout);
    }
    if (wizardResult.stderr) {
      logger.error(wizardResult.stderr);
    }
    throw new Error('Wizard execution failed');
  }

  logSuccess('✓ Wizard completed successfully');
  return configPath;
}

/**
 * Processes generated files
 * @async
 * @function processGeneratedFiles
 * @param {Object} args - Parsed arguments
 * @returns {Promise<string>} Output directory path
 */
async function processGeneratedFiles(args) {
  const wizardOutputDir = path.join(process.cwd(), 'integration', args.name);
  if (!(await fileExists(wizardOutputDir))) {
    throw new Error(`Wizard output directory not found: ${wizardOutputDir}`);
  }

  const generatedFiles = await listFiles(wizardOutputDir);
  logInfo(`\n3. Generated files: ${generatedFiles.join(', ')}`);

  const outputDir = args.output || wizardOutputDir;
  if (outputDir !== wizardOutputDir) {
    logInfo(`\n4. Copying files to: ${outputDir}`);
    const copiedFiles = await copyDirectoryContents(wizardOutputDir, outputDir);
    logSuccess(`✓ Copied ${copiedFiles.length} files`);
  } else {
    logInfo(`\n4. Files are in: ${outputDir}`);
  }

  return { outputDir, wizardOutputDir };
}

/**
 * Prints summary information
 * @async
 * @function printSummary
 * @param {string} outputDir - Output directory path
 * @param {string} appName - Application name
 * @param {string} environment - Environment name
 * @returns {Promise<void>} Resolves when summary is printed
 */
async function printSummary(outputDir, appName, environment) {
  logSuccess('\n✓ HubSpot integration created successfully!');
  logger.log('\nGenerated files:');
  const files = await listFiles(outputDir);
  for (const file of files) {
    logger.log(`  - ${file}`);
  }

  logger.log('\nNext steps:');
  logger.log(`  1. Review files in: ${outputDir}`);
  logger.log('  2. Edit hubspot-system.json and datasource files as needed');
  logger.log(`  3. Validate: node bin/aifabrix.js validate ${appName}`);
  logger.log(`  4. Deploy: node bin/aifabrix.js deploy ${appName} --environment ${environment}`);
}

/**
 * Cleans up temporary files
 * @async
 * @function cleanupFiles
 * @param {string} configPath - Config file path
 * @param {string} wizardOutputDir - Wizard output directory
 * @param {string} outputDir - Final output directory
 * @param {boolean} keepWizardFiles - Whether to keep wizard files
 * @returns {Promise<void>} Resolves when cleanup is complete
 */
async function cleanupFiles(configPath, wizardOutputDir, outputDir, keepWizardFiles) {
  if (!keepWizardFiles && outputDir !== wizardOutputDir) {
    logInfo('\n5. Cleaning up wizard files...');
    await fs.rm(wizardOutputDir, { recursive: true, force: true });
    logSuccess('✓ Cleaned up wizard files');
  }

  await fs.unlink(configPath).catch(() => {
    // Ignore errors
  });
}

/**
 * Main function
 * @async
 * @function main
 * @returns {Promise<void>} Resolves when complete
 */
async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printUsage();
    return;
  }

  try {
    validateArgs(args);
    await validateOpenApiFile(args.openapi);

    logInfo(`Creating HubSpot integration: ${args.name}`);
    logInfo(`OpenAPI file: ${args.openapi}`);
    logInfo(`Controller: ${args.controller}`);
    logInfo(`Environment: ${args.environment}`);
    const configPath = await executeWizard(args);
    const { outputDir, wizardOutputDir } = await processGeneratedFiles(args);
    await printSummary(outputDir, args.name, args.environment);
    await cleanupFiles(configPath, wizardOutputDir, outputDir, args.keepWizardFiles);
  } catch (error) {
    logError(`Error: ${error.message}`);
    if (error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}
main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});
