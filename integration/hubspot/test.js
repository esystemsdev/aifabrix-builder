#!/usr/bin/env node
/**
 * HubSpot External System Wizard E2E Test Runner
 *
 * @fileoverview Runs end-to-end wizard tests for HubSpot integration.
 * @author AI Fabrix Team
 * @version 2.0.0
 */
/* eslint-disable max-lines */
'use strict';

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { getDeploymentAuth } = require('../../lib/utils/token-manager');
const { discoverDataplaneUrl } = require('../../lib/commands/wizard-dataplane');
const { resolveControllerUrl } = require('../../lib/utils/controller-url');
const { resolveEnvironment } = require('../../lib/core/config');

const execFileAsync = promisify(execFile);

/** Single source for test config: integration/hubspot/.env */
const HUBSPOT_DIR = path.join(process.cwd(), 'integration', 'hubspot');
const LOCAL_ENV_PATH = path.join(HUBSPOT_DIR, '.env');
const ARTIFACT_DIR = path.join(HUBSPOT_DIR, 'test-artifacts');
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Error class for skipping tests
 * @class SkipTestError
 * @extends Error
 */
class SkipTestError extends Error {
  /**
   * Creates a SkipTestError
   * @param {string} message - Error message
   */
  constructor(message) {
    super(message);
    this.name = 'SkipTestError';
  }
}

/**
 * Parses command line arguments
 * @function parseArgs
 * @param {string[]} argv - Command line arguments
 * @returns {Object} Parsed arguments object with tests, types, verbose, keepArtifacts, help
 */
function parseArgs(argv) {
  const args = {
    tests: [],
    types: [],
    verbose: false,
    keepArtifacts: false,
    help: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--test' && argv[i + 1]) {
      args.tests = argv[i + 1].split(',').map(item => item.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === '--type' && argv[i + 1]) {
      args.types = argv[i + 1].split(',').map(item => item.trim()).filter(Boolean);
      i += 1;
      continue;
    }
    if (arg === '--verbose') {
      args.verbose = true;
      continue;
    }
    if (arg === '--keep-artifacts') {
      args.keepArtifacts = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

/**
 * Prints usage information
 * @function printUsage
 * @returns {void}
 */
function printUsage() {
  // eslint-disable-next-line no-console
  console.log([
    'Usage:',
    '  node integration/hubspot/test.js',
    '  node integration/hubspot/test.js --test "1.1"',
    '  node integration/hubspot/test.js --type positive',
    '  node integration/hubspot/test.js --type negative --verbose',
    '',
    'Options:',
    '  --test <id[,id]>       Run specific test IDs',
    '  --type <type[,type]>   Filter by type (positive|negative|real-data)',
    '  --verbose              Verbose command output',
    '  --keep-artifacts       Keep generated test artifacts',
    '  -h, --help             Show help'
  ].join('\n'));
}

/**
 * Logs info message
 * @function logInfo
 * @param {string} message - Message to log
 * @returns {void}
 */
function logInfo(message) {
  // eslint-disable-next-line no-console
  console.log(chalk.cyan(message));
}

/**
 * Logs success message
 * @function logSuccess
 * @param {string} message - Message to log
 * @returns {void}
 */
function logSuccess(message) {
  // eslint-disable-next-line no-console
  console.log(chalk.green(message));
}

/**
 * Logs warning message
 * @function logWarn
 * @param {string} message - Message to log
 * @returns {void}
 */
function logWarn(message) {
  // eslint-disable-next-line no-console
  console.warn(chalk.yellow(message));
}

/**
 * Logs error message
 * @function logError
 * @param {string} message - Message to log
 * @returns {void}
 */
function logError(message) {
  // eslint-disable-next-line no-console
  console.error(chalk.red(message));
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
 * Parses environment file content
 * @function parseEnvFile
 * @param {string} content - Environment file content
 * @returns {Object<string, string>} Parsed environment variables object
 */
function parseEnvFile(content) {
  const envVars = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    }
    envVars[key] = value;
  }
  return envVars;
}

/**
 * Stable stringify for comparison
 * @function stableStringify
 * @param {*} value - Value to stringify
 * @returns {string} Stable JSON string
 */
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Normalizes file content for comparisons
 * @function normalizeFileContent
 * @param {string} filePath - File path
 * @param {string} content - File content
 * @returns {string} Normalized content
 */
function normalizeFileContent(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    return stableStringify(JSON.parse(content));
  }
  if (ext === '.yaml' || ext === '.yml') {
    return stableStringify(yaml.load(content));
  }
  return content.trim();
}

/**
 * Loads environment file
 * @async
 * @function loadEnvFile
 * @param {string} envPath - Path to environment file
 * @param {Object} options - Options object
 * @param {boolean} options.verbose - Verbose logging flag
 * @returns {Promise<void>} Resolves when environment file is loaded
 */
async function loadEnvFile(envPath, options) {
  const exists = await fileExists(envPath);
  if (!exists) {
    logWarn(`Env file not found: ${envPath}`);
    return;
  }
  const content = await fs.readFile(envPath, 'utf8');
  const parsed = parseEnvFile(content);
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  // Map common .env keys so tests and wizard use credentials from integration/hubspot/.env
  if (process.env.CLIENTID && process.env.HUBSPOT_CLIENT_ID === undefined) {
    process.env.HUBSPOT_CLIENT_ID = process.env.CLIENTID;
  }
  if (process.env.CLIENTSECRET && process.env.HUBSPOT_CLIENT_SECRET === undefined) {
    process.env.HUBSPOT_CLIENT_SECRET = process.env.CLIENTSECRET;
  }
  if (options.verbose) {
    logInfo(`Loaded env vars from: ${envPath}`);
  }
}

/**
 * Load test config (controller, environment, dataplane, openapi file).
 * Reads integration/hubspot/.env; missing CONTROLLER_URL/ENVIRONMENT fall back to
 * the same resolution as the CLI (aifx auth status) so tests use the same controller.
 * @async
 * @function loadTestConfigFromEnv
 * @returns {Promise<Object>} Context with controllerUrl, environment, dataplaneUrl, openapiFile
 */
async function loadTestConfigFromEnv() {
  const defaults = {
    DATAPLANE_URL: '',
    HUBSPOT_OPENAPI_FILE: path.join(HUBSPOT_DIR, 'companies.json')
  };
  let parsed = {};
  try {
    if (fsSync.existsSync(LOCAL_ENV_PATH)) {
      const content = await fs.readFile(LOCAL_ENV_PATH, 'utf8');
      parsed = parseEnvFile(content);
    }
  } catch (error) {
    logWarn(`Could not read ${LOCAL_ENV_PATH}: ${error.message}`);
  }
  const controllerUrl = parsed.CONTROLLER_URL
    ? parsed.CONTROLLER_URL.trim()
    : await resolveControllerUrl();
  const environment = parsed.ENVIRONMENT
    ? parsed.ENVIRONMENT.trim()
    : await resolveEnvironment();
  return {
    controllerUrl,
    environment,
    dataplaneUrl: parsed.DATAPLANE_URL || defaults.DATAPLANE_URL,
    openapiFile: parsed.HUBSPOT_OPENAPI_FILE || defaults.HUBSPOT_OPENAPI_FILE
  };
}

/**
 * Ensure dataplane URL is available for tests
 * @async
 * @function ensureDataplaneUrl
 * @param {Object} context - Test context
 * @param {string} appName - Application name
 * @returns {Promise<string>} Dataplane URL
 */
async function ensureDataplaneUrl(context, appName) {
  if (context.dataplaneUrl) {
    return context.dataplaneUrl;
  }
  const authConfig = await getDeploymentAuth(context.controllerUrl, context.environment, appName);
  const dataplaneUrl = await discoverDataplaneUrl(context.controllerUrl, context.environment, authConfig);
  context.dataplaneUrl = dataplaneUrl;
  return dataplaneUrl;
}

/**
 * Ensures environment variable is set
 * @function ensureEnvVar
 * @param {string} name - Variable name
 * @param {string} value - Variable value
 * @returns {void}
 */
function ensureEnvVar(name, value) {
  if (process.env[name] === undefined && value !== undefined && value !== null && value !== '') {
    process.env[name] = value;
  }
}

/**
 * Requires environment variables to be set
 * @function requireEnvVars
 * @param {string[]} names - Array of variable names
 * @returns {void}
 * @throws {SkipTestError} If any required variable is missing
 */
function requireEnvVars(names) {
  const missing = names.filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new SkipTestError(`Missing required env vars: ${missing.join(', ')}`);
  }
}

/**
 * Runs a command
 * @async
 * @function runCommand
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @param {Object} options - Options object
 * @param {boolean} options.verbose - Verbose logging flag
 * @returns {Promise<Object>} Command result object with success, stdout, stderr
 */
async function runCommand(command, args, options) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: process.cwd(),
      env: { ...process.env },
      maxBuffer: MAX_OUTPUT_BYTES,
      timeout: COMMAND_TIMEOUT_MS
    });
    if (options.verbose) {
      if (result.stdout) {
        logInfo(result.stdout.trim());
      }
      if (result.stderr) {
        logWarn(result.stderr.trim());
      }
    }
    return { success: true, stdout: result.stdout || '', stderr: result.stderr || '' };
  } catch (error) {
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';
    if (options.verbose) {
      if (stdout) {
        logInfo(stdout.trim());
      }
      if (stderr) {
        logWarn(stderr.trim());
      }
    }
    return { success: false, stdout, stderr, error };
  }
}

/**
 * Validates authentication status
 * @async
 * @function validateAuth
 * @param {Object} context - Test context
 * @param {string} context.controllerUrl - Controller URL
 * @param {string} context.environment - Environment name
 * @param {Object} options - Options object
 * @returns {Promise<void>} Resolves when authentication is validated
 * @throws {Error} If authentication fails
 */
async function validateAuth(context, options) {
  logInfo('Validating authentication status...');
  const configArgs = [
    'bin/aifabrix.js',
    'auth',
    'config',
    '--set-controller',
    context.controllerUrl,
    '--set-environment',
    context.environment
  ];
  await runCommand('node', configArgs, options);
  const args = ['bin/aifabrix.js', 'auth', 'status'];
  const result = await runCommand('node', args, options);
  if (!result.success) {
    throw new Error('Authentication check failed. Run: node bin/aifabrix.js login --controller <url> --method device');
  }
  const output = `${result.stdout}\n${result.stderr}`;
  // Only treat "Not authenticated" as failure; "✗ Not reachable" (dataplane) is not auth failure
  if (output.includes('Not authenticated')) {
    throw new Error('Not authenticated. Run: node bin/aifabrix.js login --controller <url> --method device');
  }
  logSuccess('Authentication validated.');
}

/**
 * Writes wizard configuration to file
 * @async
 * @function writeWizardConfig
 * @param {string} name - Configuration name
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Path to written configuration file
 */
async function writeWizardConfig(name, config) {
  await ensureDir(ARTIFACT_DIR);
  const configPath = path.join(ARTIFACT_DIR, `${name}.yaml`);
  const serialized = yaml.dump(config, { lineWidth: -1, noRefs: true });
  await fs.writeFile(configPath, serialized, 'utf8');
  return configPath;
}

/**
 * Lists files in a directory recursively
 * @async
 * @function listFilesRecursive
 * @param {string} dirPath - Directory path
 * @param {string} [prefix=''] - Prefix for file paths
 * @returns {Promise<string[]>} Array of file paths
 */
async function listFilesRecursive(dirPath, prefix = '') {
  const files = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const subFiles = await listFilesRecursive(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }
  } catch (error) {
    // Ignore errors, return empty array
  }
  return files;
}

/**
 * Checks if application directory exists
 * @async
 * @function checkAppDirectory
 * @param {string} appPath - Application directory path
 * @returns {Promise<string[]>} Directory entries
 * @throws {Error} If directory doesn't exist or can't be read
 */
async function checkAppDirectory(appPath) {
  const dirExists = await fileExists(appPath);
  if (!dirExists) {
    throw new Error(`Application directory does not exist: ${appPath}. Wizard may have failed to create files.`);
  }
  try {
    return await fs.readdir(appPath);
  } catch (error) {
    throw new Error(`Failed to read application directory ${appPath}: ${error.message}`);
  }
}

/**
 * Validates required files exist
 * @async
 * @function validateRequiredFiles
 * @param {string} appPath - Application directory path
 * @param {string[]} entries - Directory entries
 * @returns {Promise<void>} Resolves when all required files are validated
 * @throws {Error} If required files are missing
 */
async function validateRequiredFiles(appPath, entries) {
  const requiredFiles = ['application.yaml', 'env.template', 'README.md', 'deploy.js'];
  const missingFiles = [];
  for (const fileName of requiredFiles) {
    const filePath = path.join(appPath, fileName);
    const exists = await fileExists(filePath);
    if (!exists) {
      missingFiles.push(fileName);
    }
  }
  if (missingFiles.length > 0) {
    const allFiles = await listFilesRecursive(appPath);
    throw new Error(
      `Missing required files in ${appPath}: ${missingFiles.join(', ')}\n` +
      'Directory exists: true\n' +
      `Files found in directory: ${entries.length > 0 ? entries.join(', ') : 'none'}\n` +
      `All files (recursive): ${allFiles.length > 0 ? allFiles.join(', ') : 'none'}`
    );
  }
}

/**
 * Validates deploy JSON files exist
 * @function validateDeployFiles
 * @param {string} appPath - Application directory path
 * @param {string[]} entries - Directory entries
 * @returns {string[]} Deploy file names
 * @throws {Error} If no deploy files found
 */
function validateDeployFiles(appPath, entries) {
  const deployFiles = entries.filter(file => /-deploy.*\.json$/.test(file));
  if (deployFiles.length === 0) {
    throw new Error(`No deploy JSON files found in: ${appPath}. Found files: ${entries.join(', ')}`);
  }
  return deployFiles;
}

/**
 * Validates file contents syntax
 * @async
 * @function validateFileContents
 * @param {string} appPath - Application directory path
 * @param {string[]} deployFiles - Deploy file names
 * @returns {Promise<void>} Resolves when all file contents are validated
 * @throws {Error} If file contents are invalid
 */
async function validateFileContents(appPath, deployFiles) {
  try {
    const variablesContent = await fs.readFile(path.join(appPath, 'application.yaml'), 'utf8');
    yaml.load(variablesContent);
  } catch (error) {
    throw new Error(`Invalid YAML syntax in application.yaml: ${error.message}`);
  }
  for (const fileName of deployFiles) {
    try {
      const fileContent = await fs.readFile(path.join(appPath, fileName), 'utf8');
      JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Invalid JSON syntax in ${fileName}: ${error.message}`);
    }
  }
}

/**
 * Validates generated files exist and are valid
 * @async
 * @function validateGeneratedFiles
 * @param {string} appName - Application name
 * @returns {Promise<void>} Resolves when all files are validated
 * @throws {Error} If required files are missing or invalid
 */
async function validateGeneratedFiles(appName) {
  const appPath = path.join(process.cwd(), 'integration', appName);
  const entries = await checkAppDirectory(appPath);
  await validateRequiredFiles(appPath, entries);
  const deployFiles = validateDeployFiles(appPath, entries);
  await validateFileContents(appPath, deployFiles);
}

/**
 * Captures a snapshot of external system files for comparison
 * @async
 * @function captureExternalSnapshot
 * @param {string} appPath - Application directory path
 * @returns {Promise<Object>} Snapshot of file contents keyed by path
 */
async function captureExternalSnapshot(appPath) {
  const variablesPath = path.join(appPath, 'application.yaml');
  const variablesContent = await fs.readFile(variablesPath, 'utf8');
  const variables = yaml.load(variablesContent);

  if (!variables || !variables.externalIntegration) {
    throw new Error(`externalIntegration block not found in ${variablesPath}`);
  }

  const systemFiles = variables.externalIntegration.systems || [];
  const datasourceFiles = variables.externalIntegration.dataSources || [];
  const fileNames = [
    'application.yaml',
    'env.template',
    'README.md',
    ...systemFiles,
    ...datasourceFiles
  ];

  const rbacPath = path.join(appPath, 'rbac.yml');
  if (await fileExists(rbacPath)) {
    fileNames.push('rbac.yml');
  }

  const snapshot = {};
  for (const fileName of fileNames) {
    const filePath = path.join(appPath, fileName);
    if (!(await fileExists(filePath))) {
      throw new Error(`Expected file not found: ${filePath}`);
    }
    const content = await fs.readFile(filePath, 'utf8');
    snapshot[filePath] = normalizeFileContent(filePath, content);
  }

  return snapshot;
}

/**
 * Compares snapshots and throws on differences
 * @function compareSnapshots
 * @param {Object} before - Snapshot before
 * @param {Object} after - Snapshot after
 * @returns {void}
 */
function compareSnapshots(before, after) {
  for (const [filePath, content] of Object.entries(before)) {
    if (!Object.prototype.hasOwnProperty.call(after, filePath)) {
      throw new Error(`File missing after split: ${filePath}`);
    }
    if (after[filePath] !== content) {
      throw new Error(`File content mismatch after split: ${filePath}`);
    }
  }
}

/**
 * Checks if app name is a test app name
 * @function isTestAppName
 * @param {string} appName - Application name
 * @returns {boolean} True if test app name
 */
function isTestAppName(appName) {
  return appName.startsWith('hubspot-test-');
}

/**
 * Cleans up app artifacts
 * @async
 * @function cleanupAppArtifacts
 * @param {string} appName - Application name
 * @param {Object} options - Options object
 * @param {boolean} options.keepArtifacts - Keep artifacts flag
 * @returns {Promise<void>} Resolves when cleanup is complete
 * @throws {Error} If app name is not a test app name
 */
async function cleanupAppArtifacts(appName, options) {
  if (options.keepArtifacts) {
    return;
  }
  if (!isTestAppName(appName)) {
    throw new Error(`Refusing to delete non-test app directory: ${appName}`);
  }
  const appPath = path.join(process.cwd(), 'integration', appName);
  await fs.rm(appPath, { recursive: true, force: true });
}

/**
 * Runs wizard command
 * @async
 * @function runWizard
 * @param {string} configPath - Path to wizard config file
 * @param {Object} context - Test context
 * @param {Object} options - Options object
 * @returns {Promise<Object>} Command result object
 */
async function runWizard(configPath, context, options) {
  const args = ['bin/aifabrix.js', 'wizard', '--config', configPath];
  return await runCommand('node', args, options);
}

/**
 * Builds command arguments for external system commands
 * @function buildExternalCommandArgs
 * @param {string} command - Command name (download, json, split-json)
 * @param {string} appName - Application name
 * @returns {string[]} Command arguments array
 */
function buildExternalCommandArgs(command, appName) {
  const args = ['bin/aifabrix.js', command, appName];
  if (command !== 'download') {
    args.push('--type', 'external');
  }
  return args;
}

/**
 * Runs a command and handles errors, with special handling for "not found" cases
 * @async
 * @function runCommandWithErrorHandling
 * @param {string} command - Command description for error messages
 * @param {string[]} args - Command arguments
 * @param {Object} options - Options object
 * @param {string} [appName] - Application name (for skip logic)
 * @returns {Promise<Object>} Command result object
 * @throws {Error} If command fails (unless it's a "not found" case)
 */
async function runCommandWithErrorHandling(command, args, options, appName) {
  const result = await runCommand('node', args, options);
  if (!result.success) {
    const errorOutput = `${result.stdout}\n${result.stderr}`;
    if (appName && (errorOutput.includes('not found') ||
        (errorOutput.includes('External system') && errorOutput.includes('not found')))) {
      logInfo(`System ${appName} not deployed on dataplane; download step omitted (optional).`);
      return { skipped: true };
    }
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result;
}

/**
 * Downloads external system and validates split workflow
 * @async
 * @function testDownloadAndSplit
 * @param {string} appName - Application name
 * @param {Object} context - Test context
 * @param {Object} options - Options object
 * @returns {Promise<void>} Resolves when download and split validation succeeds
 */
async function testDownloadAndSplit(appName, context, options) {
  logInfo(`Downloading external system ${appName}...`);
  const downloadArgs = buildExternalCommandArgs('download', appName);
  const downloadResult = await runCommandWithErrorHandling('Download', downloadArgs, options, appName);
  if (downloadResult.skipped) {
    return;
  }

  const appPath = path.join(process.cwd(), 'integration', appName);
  const snapshotBefore = await captureExternalSnapshot(appPath);

  logInfo('Generating application-schema.json...');
  const jsonArgs = buildExternalCommandArgs('json', appName);
  await runCommandWithErrorHandling('JSON generation', jsonArgs, options);

  logInfo('Splitting application-schema.json...');
  const splitArgs = buildExternalCommandArgs('split-json', appName);
  await runCommandWithErrorHandling('Split', splitArgs, options);

  const snapshotAfter = await captureExternalSnapshot(appPath);
  compareSnapshots(snapshotBefore, snapshotAfter);
  logSuccess('Download and split workflow validated.');
}

/**
 * Runs wizard and validates generated files
 * @async
 * @function runWizardAndValidate
 * @param {string} configPath - Path to wizard config file
 * @param {string} appName - Application name
 * @param {Object} context - Test context
 * @param {Object} options - Options object
 * @returns {Promise<void>} Resolves when wizard completes and files are validated
 * @throws {Error} If wizard fails or validation fails
 */
async function runWizardAndValidate(configPath, appName, context, options) {
  const result = await runWizard(configPath, context, options);
  if (!result.success) {
    const errorOutput = `${result.stdout}\n${result.stderr}`;
    throw new Error(`Wizard failed for ${appName}:\n${errorOutput}`);
  }

  // Wait a brief moment to ensure file system operations complete
  await new Promise(resolve => setTimeout(resolve, 100));

  // Validate files were created
  if (options.verbose) {
    logInfo(`Validating files for ${appName}...`);
  }
  await validateGeneratedFiles(appName);

  if (options.verbose) {
    const appPath = path.join(process.cwd(), 'integration', appName);
    const entries = await fs.readdir(appPath);
    logSuccess(`Files created successfully: ${entries.join(', ')}`);
  }

  await testDownloadAndSplit(appName, context, options);

  await cleanupAppArtifacts(appName, options);
}

/**
 * Runs wizard expecting failure
 * @async
 * @function runWizardExpectFailure
 * @param {string} configPath - Path to wizard config file
 * @param {Object} context - Test context
 * @param {Object} options - Options object
 * @param {string} [expectedMessage] - Expected error message
 * @returns {Promise<void>} Resolves when wizard fails as expected
 * @throws {Error} If wizard succeeds or expected message not found
 */
async function runWizardExpectFailure(configPath, context, options, expectedMessage = null) {
  const result = await runWizard(configPath, context, options);
  if (result.success) {
    throw new Error('Expected wizard to fail, but it succeeded.');
  }
  if (expectedMessage) {
    const combined = `${result.stdout}\n${result.stderr}`;
    if (!combined.includes(expectedMessage)) {
      throw new Error(`Expected error message not found: ${expectedMessage}`);
    }
  }
}

/**
 * Checks if test case matches selection criteria
 * @function matchesSelection
 * @param {Object} testCase - Test case object
 * @param {string[]} selections - Selection criteria
 * @returns {boolean} True if matches
 */
function matchesSelection(testCase, selections) {
  if (!selections || selections.length === 0) {
    return true;
  }
  const lowerSelections = selections.map(item => item.toLowerCase());
  const idMatch = lowerSelections.includes(testCase.id.toLowerCase());
  const nameMatch = lowerSelections.some(item => testCase.name.toLowerCase().includes(item));
  return idMatch || nameMatch;
}

/**
 * Checks if test case matches type criteria
 * @function matchesType
 * @param {Object} testCase - Test case object
 * @param {string[]} types - Type criteria
 * @returns {boolean} True if matches
 */
function matchesType(testCase, types) {
  if (!types || types.length === 0) {
    return true;
  }
  return types.map(type => type.toLowerCase()).includes(testCase.type.toLowerCase());
}

/**
 * Builds positive test cases
 * @function buildPositiveTestCases
 * @param {Object} context - Test context
 * @returns {Array<Object>} Array of positive test case objects
 */
// eslint-disable-next-line max-lines-per-function, require-jsdoc
function buildPositiveTestCases(context) {
  return [
    {
      id: '1.1',
      type: 'positive',
      name: 'Complete wizard flow with OpenAPI file',
      run: async(options) => {
        const configPath = path.join(HUBSPOT_DIR, 'wizard-hubspot-e2e.yaml');
        if (!(await fileExists(configPath))) {
          throw new Error(`Missing config file: ${configPath}`);
        }
        if (!(await fileExists(context.openapiFile))) {
          throw new Error(`OpenAPI file not found: ${context.openapiFile}`);
        }
        ensureEnvVar('CONTROLLER_URL', context.controllerUrl);
        // Try to run wizard - if dataplane discovery fails, skip the test
        const result = await runWizard(configPath, context, options);
        if (!result.success) {
          const errorOutput = `${result.stdout}\n${result.stderr}`;
          if (errorOutput.includes('Failed to discover dataplane URL') ||
              errorOutput.includes('Application not found')) {
            throw new SkipTestError('Dataplane service not found in environment. Deploy dataplane service to the controller.');
          }
          throw new Error(`Wizard failed: ${errorOutput}`);
        }
        await validateGeneratedFiles('hubspot-test-e2e');
        await cleanupAppArtifacts('hubspot-test-e2e', options);
      }
    },
    {
      id: '1.2',
      type: 'positive',
      name: 'Wizard flow with known platform',
      run: async(options) => {
        const configPath = path.join(HUBSPOT_DIR, 'wizard-hubspot-platform.yaml');
        if (!(await fileExists(configPath))) {
          throw new Error(`Missing config file: ${configPath}`);
        }
        try {
          await ensureDataplaneUrl(context, 'hubspot-test-platform');
        } catch (error) {
          throw new SkipTestError(`Dataplane service not found: ${error.message}`);
        }
        await runWizardAndValidate(configPath, 'hubspot-test-platform', context, options);
      }
    },
    {
      id: '1.6',
      type: 'positive',
      name: 'Wizard flow with environment variables',
      run: async(options) => {
        let dataplaneUrl;
        try {
          dataplaneUrl = await ensureDataplaneUrl(context, 'hubspot-test-env-vars');
        } catch (error) {
          throw new SkipTestError(`Dataplane service not found: ${error.message}`);
        }
        ensureEnvVar('CONTROLLER_URL', context.controllerUrl);
        ensureEnvVar('DATAPLANE_URL', dataplaneUrl);
        const configPath = await writeWizardConfig('wizard-hubspot-env-vars', {
          appName: 'hubspot-test-env-vars',
          mode: 'create-system',
          source: {
            type: 'openapi-file',
            filePath: context.openapiFile
          },
          deployment: {
            controller: '${CONTROLLER_URL}',
            dataplane: '${DATAPLANE_URL}',
            environment: context.environment
          }
        });
        await runWizardAndValidate(configPath, 'hubspot-test-env-vars', context, options);
      }
    }
  ];
}

/**
 * Builds real-data test cases
 * @function buildRealDataTestCases
 * @param {Object} context - Test context
 * @returns {Array<Object>} Array of real-data test cases
 */
function buildRealDataTestCases(context) {
  return [
    {
      id: '1.3',
      type: 'real-data',
      name: 'Wizard flow with real credential creation',
      run: async(options) => {
        if (!(await fileExists(context.openapiFile))) {
          throw new Error(`OpenAPI file not found: ${context.openapiFile}`);
        }
        requireEnvVars(['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET']);
        ensureEnvVar('HUBSPOT_TOKEN_URL', 'https://api.hubapi.com/oauth/v1/token');
        const configPath = await writeWizardConfig('wizard-hubspot-credential-real', {
          appName: 'hubspot-test-credential-real',
          mode: 'create-system',
          source: {
            type: 'openapi-file',
            filePath: context.openapiFile
          },
          credential: {
            action: 'create',
            config: {
              key: 'hubspot-test-cred-real',
              displayName: 'HubSpot Test Credential (Real)',
              type: 'OAUTH2',
              config: {
                tokenUrl: '${HUBSPOT_TOKEN_URL}',
                clientId: '${HUBSPOT_CLIENT_ID}',
                clientSecret: '${HUBSPOT_CLIENT_SECRET}',
                scopes: [
                  'crm.objects.companies.read',
                  'crm.objects.companies.write',
                  'crm.objects.contacts.read',
                  'crm.objects.contacts.write'
                ]
              }
            }
          }
        });
        await runWizardAndValidate(configPath, 'hubspot-test-credential-real', context, options);
      }
    }
  ];
}

/**
 * Builds negative config validation test cases
 * @function buildNegativeConfigTestCases
 * @param {Object} context - Test context
 * @returns {Array<Object>} Array of negative config test case objects
 */
// eslint-disable-next-line max-lines-per-function, require-jsdoc
function buildNegativeConfigTestCases(context) {
  return [
    {
      id: '2.1',
      type: 'negative',
      name: 'Invalid config missing appName',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-missing-app', {
          mode: 'create-system',
          source: { type: 'known-platform', platform: 'hubspot' }
        });
        await runWizardExpectFailure(configPath, context, options, 'Missing required field: appName');
      }
    },
    {
      id: '2.2',
      type: 'negative',
      name: 'Invalid app name with uppercase',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-app-name', {
          appName: 'HubSpot-Test',
          mode: 'create-system',
          source: { type: 'known-platform', platform: 'hubspot' }
        });
        await runWizardExpectFailure(configPath, context, options, 'must match pattern');
      }
    },
    {
      id: '2.3',
      type: 'negative',
      name: 'Missing source block',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-missing-source', {
          appName: 'hubspot-test-negative-missing-source',
          mode: 'create-system'
        });
        await runWizardExpectFailure(configPath, context, options, 'Missing required field: source');
      }
    },
    {
      id: '2.4',
      type: 'negative',
      name: 'Invalid source type',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-source', {
          appName: 'hubspot-test-negative-source',
          mode: 'create-system',
          source: { type: 'invalid-type' }
        });
        await runWizardExpectFailure(configPath, context, options, 'Allowed values');
      }
    },
    {
      id: '2.5',
      type: 'negative',
      name: 'Invalid mode',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-mode', {
          appName: 'hubspot-test-negative-mode',
          mode: 'invalid-mode',
          source: { type: 'known-platform', platform: 'hubspot' }
        });
        await runWizardExpectFailure(configPath, context, options, 'Allowed values');
      }
    },
    {
      id: '2.6',
      type: 'negative',
      name: 'Known platform missing platform',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-known-platform', {
          appName: 'hubspot-test-negative-platform',
          mode: 'create-system',
          source: { type: 'known-platform' }
        });
        await runWizardExpectFailure(configPath, context, options, 'Missing required field: platform');
      }
    },
    {
      id: '2.7',
      type: 'negative',
      name: 'Missing OpenAPI file path',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-openapi-file', {
          appName: 'hubspot-test-negative-openapi',
          mode: 'create-system',
          source: { type: 'openapi-file', filePath: '/tmp/does-not-exist.json' }
        });
        await runWizardExpectFailure(configPath, context, options, 'OpenAPI file not found');
      }
    },
    {
      id: '2.8',
      type: 'negative',
      name: 'OpenAPI URL missing url',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-openapi-url', {
          appName: 'hubspot-test-negative-openapi-url',
          mode: 'create-system',
          source: { type: 'openapi-url' }
        });
        await runWizardExpectFailure(configPath, context, options, 'Missing required field: url');
      }
    }
  ];
}

/**
 * Builds negative credential and datasource test cases
 * @function buildNegativeCredentialTestCases
 * @param {Object} context - Test context
 * @returns {Array<Object>} Array of negative credential test cases
 */
function buildNegativeCredentialTestCases(context) {
  return [
    {
      id: '2.9',
      type: 'negative',
      name: 'Add datasource missing systemIdOrKey',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-add-datasource', {
          appName: 'hubspot-test-negative-add-datasource',
          mode: 'add-datasource',
          source: { type: 'known-platform', platform: 'hubspot' }
        });
        await runWizardExpectFailure(configPath, context, options, 'systemIdOrKey');
      }
    },
    {
      id: '2.10',
      type: 'negative',
      name: 'Credential select missing credentialIdOrKey',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-credential-select', {
          appName: 'hubspot-test-negative-credential-select',
          mode: 'create-system',
          source: { type: 'known-platform', platform: 'hubspot' },
          credential: { action: 'select' }
        });
        await runWizardExpectFailure(configPath, context, options, 'Missing required field: credentialIdOrKey');
      }
    },
    {
      id: '2.11',
      type: 'negative',
      name: 'Credential create missing config',
      run: async(options) => {
        const configPath = await writeWizardConfig('wizard-invalid-credential-create', {
          appName: 'hubspot-test-negative-credential-create',
          mode: 'create-system',
          source: { type: 'known-platform', platform: 'hubspot' },
          credential: { action: 'create' }
        });
        await runWizardExpectFailure(configPath, context, options, 'Missing required field: config');
      }
    }
  ];
}

/**
 * Runs validation command and expects failure
 * @async
 * @function runValidationExpectFailure
 * @param {string} appName - Application name
 * @param {Object} context - Test context
 * @param {Object} options - Options object
 * @param {string} expectedMessage - Expected error message
 * @returns {Promise<void>} Resolves when validation fails as expected
 * @throws {Error} If validation succeeds or expected message not found
 */
async function runValidationExpectFailure(appName, context, options, expectedMessage = null) {
  const validateArgs = [
    'bin/aifabrix.js',
    'validate',
    appName,
    '--type',
    'external'
  ];
  const result = await runCommand('node', validateArgs, options);
  if (result.success) {
    throw new Error('Expected validation to fail, but it succeeded.');
  }
  if (expectedMessage) {
    const combined = `${result.stdout}\n${result.stderr}`;
    if (!combined.includes(expectedMessage)) {
      throw new Error(`Expected error message not found: ${expectedMessage}\nActual output: ${combined}`);
    }
  }
}

/**
 * Creates a system via wizard for negative testing
 * @async
 * @function createSystemForNegativeTest
 * @param {string} appName - Application name
 * @param {string} configName - Configuration name
 * @param {Object} context - Test context
 * @param {Object} options - Options object
 * @returns {Promise<string>} Application path
 * @throws {SkipTestError} If wizard fails
 */
async function createSystemForNegativeTest(appName, configName, context, options) {
  const configPath = await writeWizardConfig(configName, {
    appName: appName,
    mode: 'create-system',
    source: { type: 'known-platform', platform: 'hubspot' }
  });
  const wizardResult = await runWizard(configPath, context, options);
  if (!wizardResult.success) {
    throw new SkipTestError(`Wizard failed to create system: ${wizardResult.stderr}`);
  }
  await new Promise(resolve => setTimeout(resolve, 200));
  return path.join(process.cwd(), 'integration', appName);
}

/**
 * Corrupts system file with invalid permission referencing non-existent role
 * @async
 * @function corruptSystemFileWithInvalidRole
 * @param {string} appPath - Application path
 * @returns {Promise<void>} Resolves when file is corrupted
 */
async function corruptSystemFileWithInvalidRole(appPath) {
  const systemFiles = await fs.readdir(appPath);
  const systemFile = systemFiles.find(f => f.includes('-system.json'));
  if (!systemFile) {
    throw new Error(`System file not found in ${appPath}`);
  }
  const systemFilePath = path.join(appPath, systemFile);
  const systemContent = await fs.readFile(systemFilePath, 'utf8');
  const systemJson = JSON.parse(systemContent);
  if (!systemJson.permissions) {
    systemJson.permissions = [];
  }
  systemJson.permissions.push({
    name: 'test:invalid',
    roles: ['non-existent-role'],
    description: 'Test permission'
  });
  await fs.writeFile(systemFilePath, JSON.stringify(systemJson, null, 2), 'utf8');
}

/**
 * Corrupts rbac.yaml with invalid YAML
 * @async
 * @function corruptRbacFile
 * @param {string} appPath - Application path
 * @returns {Promise<void>} Resolves when file is corrupted
 */
async function corruptRbacFile(appPath) {
  const rbacPath = path.join(appPath, 'rbac.yaml');
  await fs.writeFile(rbacPath, 'invalid: yaml: syntax: [', 'utf8');
}

/**
 * Gets first datasource file path
 * @async
 * @function getFirstDatasourcePath
 * @param {string} appPath - Application path
 * @returns {Promise<string>} Datasource file path
 * @throws {Error} If no datasource files found
 */
async function getFirstDatasourcePath(appPath) {
  const datasourceFiles = (await fs.readdir(appPath)).filter(f => f.includes('-datasource-'));
  if (datasourceFiles.length === 0) {
    throw new Error(`No datasource files found in ${appPath}`);
  }
  return path.join(appPath, datasourceFiles[0]);
}

/**
 * Corrupts datasource file by removing dimensions
 * @async
 * @function corruptDatasourceRemoveDimensions
 * @param {string} datasourcePath - Datasource file path
 * @returns {Promise<void>} Resolves when file is corrupted
 */
async function corruptDatasourceRemoveDimensions(datasourcePath) {
  const datasourceContent = await fs.readFile(datasourcePath, 'utf8');
  const datasourceJson = JSON.parse(datasourceContent);
  if (datasourceJson.fieldMappings) {
    delete datasourceJson.fieldMappings.dimensions;
  } else {
    datasourceJson.fieldMappings = {};
  }
  await fs.writeFile(datasourcePath, JSON.stringify(datasourceJson, null, 2), 'utf8');
}

/**
 * Corrupts datasource file with invalid dimension key
 * @async
 * @function corruptDatasourceInvalidDimensionKey
 * @param {string} datasourcePath - Datasource file path
 * @returns {Promise<void>} Resolves when file is corrupted
 */
async function corruptDatasourceInvalidDimensionKey(datasourcePath) {
  const datasourceContent = await fs.readFile(datasourcePath, 'utf8');
  const datasourceJson = JSON.parse(datasourceContent);
  if (!datasourceJson.fieldMappings) {
    datasourceJson.fieldMappings = {};
  }
  if (!datasourceJson.fieldMappings.dimensions) {
    datasourceJson.fieldMappings.dimensions = {};
  }
  datasourceJson.fieldMappings.dimensions['invalid-key-with-hyphen'] = 'metadata.id';
  await fs.writeFile(datasourcePath, JSON.stringify(datasourceJson, null, 2), 'utf8');
}

/**
 * Corrupts datasource file with invalid attribute path
 * @async
 * @function corruptDatasourceInvalidAttributePath
 * @param {string} datasourcePath - Datasource file path
 * @returns {Promise<void>} Resolves when file is corrupted
 */
async function corruptDatasourceInvalidAttributePath(datasourcePath) {
  const datasourceContent = await fs.readFile(datasourcePath, 'utf8');
  const datasourceJson = JSON.parse(datasourceContent);
  if (!datasourceJson.fieldMappings) {
    datasourceJson.fieldMappings = {};
  }
  if (!datasourceJson.fieldMappings.dimensions) {
    datasourceJson.fieldMappings.dimensions = {};
  }
  datasourceJson.fieldMappings.dimensions['valid_key'] = 'metadata.id-with-invalid-chars@';
  await fs.writeFile(datasourcePath, JSON.stringify(datasourceJson, null, 2), 'utf8');
}

/**
 * Corrupts datasource file with dimensions as array
 * @async
 * @function corruptDatasourceDimensionsAsArray
 * @param {string} datasourcePath - Datasource file path
 * @returns {Promise<void>} Resolves when file is corrupted
 */
async function corruptDatasourceDimensionsAsArray(datasourcePath) {
  const datasourceContent = await fs.readFile(datasourcePath, 'utf8');
  const datasourceJson = JSON.parse(datasourceContent);
  if (!datasourceJson.fieldMappings) {
    datasourceJson.fieldMappings = {};
  }
  datasourceJson.fieldMappings.dimensions = ['invalid', 'array', 'format'];
  await fs.writeFile(datasourcePath, JSON.stringify(datasourceJson, null, 2), 'utf8');
}

/**
 * Builds negative RBAC validation test cases
 * @function buildNegativeRbacTestCases
 * @param {Object} context - Test context
 * @returns {Array<Object>} Array of negative RBAC test cases
 */
function buildNegativeRbacTestCases(context) {
  return [
    {
      id: '2.12',
      type: 'negative',
      name: 'RBAC missing role referenced in permissions',
      run: async(options) => {
        const appName = 'hubspot-test-negative-rbac-missing-role';
        const appPath = await createSystemForNegativeTest(appName, 'wizard-valid-for-rbac-test', context, options);
        await corruptSystemFileWithInvalidRole(appPath);
        await runValidationExpectFailure(appName, context, options, 'references role "non-existent-role" which does not exist');
        await cleanupAppArtifacts(appName, options);
      }
    },
    {
      id: '2.13',
      type: 'negative',
      name: 'RBAC invalid YAML syntax',
      run: async(options) => {
        const appName = 'hubspot-test-negative-rbac-invalid-yaml';
        const appPath = await createSystemForNegativeTest(appName, 'wizard-valid-for-rbac-yaml-test', context, options);
        await corruptRbacFile(appPath);
        await runValidationExpectFailure(appName, context, options, 'Invalid YAML syntax in rbac.yaml');
        await cleanupAppArtifacts(appName, options);
      }
    }
  ];
}

/**
 * Builds negative dimension validation test cases
 * @function buildNegativeDimensionTestCases
 * @param {Object} context - Test context
 * @returns {Array<Object>} Array of negative dimension test cases
 */
function buildNegativeDimensionTestCases(context) {
  const createTestCase = (id, name, appName, configName, corruptFn, expectedError) => ({
    id,
    type: 'negative',
    name,
    run: async(options) => {
      const appPath = await createSystemForNegativeTest(appName, configName, context, options);
      const datasourcePath = await getFirstDatasourcePath(appPath);
      await corruptFn(datasourcePath);
      await runValidationExpectFailure(appName, context, options, expectedError);
      await cleanupAppArtifacts(appName, options);
    }
  });

  return [
    createTestCase(
      '2.14',
      'Datasource missing dimensions in fieldMappings',
      'hubspot-test-negative-dimension-missing',
      'wizard-valid-for-dimension-test',
      corruptDatasourceRemoveDimensions,
      'Missing required property "dimensions"'
    ),
    createTestCase(
      '2.15',
      'Datasource invalid dimension key pattern',
      'hubspot-test-negative-dimension-invalid-key',
      'wizard-valid-for-dimension-key-test',
      corruptDatasourceInvalidDimensionKey,
      'Must be at most 40 characters'
    ),
    createTestCase(
      '2.16',
      'Datasource invalid attribute path pattern',
      'hubspot-test-negative-dimension-invalid-path',
      'wizard-valid-for-dimension-path-test',
      corruptDatasourceInvalidAttributePath,
      'must match pattern'
    ),
    createTestCase(
      '2.17',
      'Datasource dimensions as array instead of object',
      'hubspot-test-negative-dimension-array',
      'wizard-valid-for-dimension-array-test',
      corruptDatasourceDimensionsAsArray,
      'Expected object, got undefined'
    )
  ];
}

/**
 * Builds negative test cases
 * @function buildNegativeTestCases
 * @param {Object} context - Test context
 * @returns {Array<Object>} Array of negative test cases
 */
function buildNegativeTestCases(context) {
  return [
    ...buildNegativeConfigTestCases(context),
    ...buildNegativeCredentialTestCases(context),
    ...buildNegativeRbacTestCases(context),
    ...buildNegativeDimensionTestCases(context)
  ];
}

/**
 * Builds all test cases
 * @function buildTestCases
 * @param {Object} context - Test context
 * @returns {Array<Object>} Array of all test cases
 */
function buildTestCases(context) {
  return [
    ...buildPositiveTestCases(context),
    ...buildRealDataTestCases(context),
    ...buildNegativeTestCases(context)
  ];
}

/**
 * Runs a test case
 * @async
 * @function runTestCase
 * @param {Object} testCase - Test case object
 * @param {Object} context - Test context
 * @param {Object} options - Options object
 * @returns {Promise<Object>} Test result object
 */
async function runTestCase(testCase, context, options) {
  const start = Date.now();
  try {
    await testCase.run(options);
    const durationMs = Date.now() - start;
    logSuccess(`PASS ${testCase.id} (${durationMs}ms) - ${testCase.name}`);
    return { id: testCase.id, status: 'passed' };
  } catch (error) {
    if (error instanceof SkipTestError) {
      logWarn(`SKIP ${testCase.id} - ${error.message}`);
      return { id: testCase.id, status: 'skipped' };
    }
    logError(`FAIL ${testCase.id} - ${error.message}`);
    return { id: testCase.id, status: 'failed', error };
  }
}

/**
 * Sets up test context and environment variables
 * @function setupTestContext
 * @param {Object} context - Test context object
 * @returns {void}
 */
function setupTestContext(context) {
  ensureEnvVar('CONTROLLER_URL', context.controllerUrl);
  ensureEnvVar('ENVIRONMENT', context.environment);
  if (context.dataplaneUrl) {
    ensureEnvVar('DATAPLANE_URL', context.dataplaneUrl);
  }
  ensureEnvVar('HUBSPOT_OPENAPI_FILE', context.openapiFile);
}

/**
 * Main function
 * @async
 * @function main
 * @returns {Promise<void>} Resolves when all tests complete
 */
async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printUsage();
    return;
  }
  await ensureDir(ARTIFACT_DIR);
  await loadEnvFile(LOCAL_ENV_PATH, args);
  const context = await loadTestConfigFromEnv();
  setupTestContext(context);
  await validateAuth(context, args);
  const testCases = buildTestCases(context).filter(testCase => (
    matchesSelection(testCase, args.tests) && matchesType(testCase, args.types)
  ));
  if (testCases.length === 0) {
    logWarn('No matching test cases found.');
    return;
  }
  const results = [];
  for (const testCase of testCases) {
    results.push(await runTestCase(testCase, context, args));
  }
  const failed = results.filter(result => result.status === 'failed');
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  logError(error.message || 'Unexpected error');
  process.exitCode = 1;
});
