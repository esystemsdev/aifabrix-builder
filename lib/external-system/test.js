/**
 * External System Testing Module
 *
 * Provides unit testing (local validation) and integration testing (via dataplane)
 * for external systems and datasources.
 *
 * @fileoverview External system testing functionality for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const testHelpers = require('../utils/external-system-test-helpers');
const { retryApiCall } = require('../utils/external-system-test-helpers');
const { getConfig } = require('../core/config');
const { detectAppType } = require('../utils/paths');
const { setupIntegrationTestAuth } = require('./test-auth');
const logger = require('../utils/logger');
const {
  validateFieldMappings,
  validateMetadataSchema,
  validateAgainstSchema
} = require('../utils/external-system-validators');
const {
  displayTestResults,
  displayIntegrationTestResults
} = require('../utils/external-system-display');
const {
  initializeTestResults,
  validateSystemFilesForTest,
  validateDatasourceFilesForTest
} = require('./test-helpers');
const {
  testSingleDatasourceIntegration
} = require('./test-execution');

/**
 * Loads and parses variables.yaml file
 * @async
 * @function loadVariablesYamlFile
 * @param {string} variablesPath - Path to variables.yaml
 * @returns {Promise<Object>} Parsed variables
 * @throws {Error} If file not found or invalid YAML
 */
async function loadVariablesYamlFile(variablesPath) {
  if (!fsSync.existsSync(variablesPath)) {
    throw new Error(`variables.yaml not found: ${variablesPath}`);
  }

  const variablesContent = await fs.readFile(variablesPath, 'utf8');
  try {
    const variables = yaml.load(variablesContent);
    if (!variables.externalIntegration) {
      throw new Error('externalIntegration block not found in variables.yaml');
    }
    return variables;
  } catch (error) {
    if (error.message.includes('externalIntegration')) {
      throw error;
    }
    throw new Error(`Invalid YAML syntax in variables.yaml: ${error.message}`);
  }
}

/**
 * Loads a single JSON file
 * @async
 * @function loadJsonFile
 * @param {string} filePath - Path to JSON file
 * @param {string} fileName - File name for error messages
 * @returns {Promise<Object>} Parsed JSON data
 * @throws {Error} If file not found or invalid JSON
 */
async function loadJsonFile(filePath, fileName) {
  if (!fsSync.existsSync(filePath)) {
    // Use "System file not found" for system files to match test expectations
    if (fileName.includes('system') || fileName.includes('deploy')) {
      throw new Error(`System file not found: ${filePath}`);
    }
    throw new Error(`${fileName} not found: ${filePath}`);
  }

  const content = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON syntax in ${fileName}: ${error.message}`);
  }
}

/**
 * Resolves file path based on schema base path
 * @function resolveFilePath
 * @param {string} schemaBasePath - Schema base path
 * @param {string} appPath - Application path
 * @param {string} fileName - File name
 * @returns {string} Resolved file path
 */
function resolveFilePath(schemaBasePath, appPath, fileName) {
  return path.isAbsolute(schemaBasePath)
    ? path.join(schemaBasePath, fileName)
    : path.join(appPath, schemaBasePath, fileName);
}

/**
 * Loads system JSON files
 * @async
 * @function loadSystemFiles
 * @param {string[]} systemFiles - Array of system file names
 * @param {string} schemaBasePath - Schema base path
 * @param {string} appPath - Application path
 * @returns {Promise<Array>} Array of system file objects
 */
async function loadSystemFiles(systemFiles, schemaBasePath, appPath) {
  const systemJsonFiles = [];
  for (const systemFile of systemFiles) {
    const systemPath = resolveFilePath(schemaBasePath, appPath, systemFile);
    const systemJson = await loadJsonFile(systemPath, systemFile);
    systemJsonFiles.push({ path: systemPath, data: systemJson });
  }
  return systemJsonFiles;
}

/**
 * Loads datasource JSON files
 * @async
 * @function loadDatasourceFiles
 * @param {string[]} datasourceFiles - Array of datasource file names
 * @param {string} schemaBasePath - Schema base path
 * @param {string} appPath - Application path
 * @returns {Promise<Array>} Array of datasource file objects
 */
async function loadDatasourceFiles(datasourceFiles, schemaBasePath, appPath) {
  const datasourceJsonFiles = [];
  for (const datasourceFile of datasourceFiles) {
    const datasourcePath = resolveFilePath(schemaBasePath, appPath, datasourceFile);
    const datasourceJson = await loadJsonFile(datasourcePath, datasourceFile);
    datasourceJsonFiles.push({ path: datasourcePath, data: datasourceJson });
  }
  return datasourceJsonFiles;
}

/**
 * Loads and validates external system files
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Loaded files and validation results
 */
async function loadExternalSystemFiles(appName) {
  const { appPath } = await detectAppType(appName);
  const variablesPath = path.join(appPath, 'variables.yaml');

  const variables = await loadVariablesYamlFile(variablesPath);

  const schemaBasePath = variables.externalIntegration.schemaBasePath || './';
  const systemFiles = variables.externalIntegration.systems || [];
  const datasourceFiles = variables.externalIntegration.dataSources || [];

  const systemJsonFiles = await loadSystemFiles(systemFiles, schemaBasePath, appPath);
  const datasourceJsonFiles = await loadDatasourceFiles(datasourceFiles, schemaBasePath, appPath);

  return {
    variables,
    systemFiles: systemJsonFiles,
    datasourceFiles: datasourceJsonFiles
  };
}

/**
 * Validate datasource against schema and relationships
 * @param {Object} datasource - Datasource configuration
 * @param {string} systemKey - System key
 * @param {Object} externalDataSourceSchema - External datasource schema
 * @returns {Object} Validation result
 */
function validateDatasourceSchema(datasource, systemKey, externalDataSourceSchema) {
  const errors = [];
  const schemaValidation = validateAgainstSchema(datasource, externalDataSourceSchema);
  if (!schemaValidation.valid) {
    errors.push(...schemaValidation.errors);
  }

  if (systemKey && datasource.systemKey !== systemKey) {
    errors.push(`systemKey mismatch: expected '${systemKey}', got '${datasource.systemKey}'`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Test datasource with payload template
 * @param {Object} datasource - Datasource configuration
 * @param {boolean} verbose - Show detailed output
 * @returns {Object} Test results
 */
function testDatasourceWithPayload(datasource, verbose) {
  const errors = [];
  const warnings = [];

  // Validate field mappings
  const fieldMappingResults = validateFieldMappings(datasource, datasource.testPayload);
  if (!fieldMappingResults.valid) {
    errors.push(...fieldMappingResults.errors);
  }
  if (fieldMappingResults.warnings.length > 0) {
    warnings.push(...fieldMappingResults.warnings);
  }

  // Validate metadata schema
  const metadataSchemaResults = validateMetadataSchema(datasource, datasource.testPayload);
  if (!metadataSchemaResults.valid) {
    errors.push(...metadataSchemaResults.errors);
  }
  if (metadataSchemaResults.warnings.length > 0) {
    warnings.push(...metadataSchemaResults.warnings);
  }

  // Compare with expectedResult if provided
  if (datasource.testPayload.expectedResult && fieldMappingResults.mappedFields && verbose) {
    warnings.push('expectedResult validation not yet implemented (requires transformation engine)');
  }

  return {
    fieldMappingResults,
    metadataSchemaResults,
    errors,
    warnings,
    valid: errors.length === 0
  };
}

/**
 * Validate a single datasource
 * @param {Object} datasourceFile - Datasource file object
 * @param {string} systemKey - System key
 * @param {Object} externalDataSourceSchema - External datasource schema
 * @param {boolean} verbose - Show detailed output
 * @returns {Object} Datasource validation result
 */
function validateSingleDatasource(datasourceFile, systemKey, externalDataSourceSchema, verbose) {
  const datasource = datasourceFile.data;
  const datasourceResult = {
    key: datasource.key,
    file: path.basename(datasourceFile.path),
    valid: true,
    errors: [],
    warnings: [],
    fieldMappingResults: null,
    metadataSchemaResults: null
  };

  // Validate against schema
  const schemaValidation = validateDatasourceSchema(datasource, systemKey, externalDataSourceSchema);
  if (!schemaValidation.valid) {
    datasourceResult.valid = false;
    datasourceResult.errors.push(...schemaValidation.errors);
  }

  // Test with testPayload if available
  if (datasource.testPayload && datasource.testPayload.payloadTemplate) {
    logger.log(chalk.blue(`  Testing datasource: ${datasource.key}`));
    const payloadTestResults = testDatasourceWithPayload(datasource, verbose);
    datasourceResult.fieldMappingResults = payloadTestResults.fieldMappingResults;
    datasourceResult.metadataSchemaResults = payloadTestResults.metadataSchemaResults;
    if (!payloadTestResults.valid) {
      datasourceResult.valid = false;
      datasourceResult.errors.push(...payloadTestResults.errors);
    }
    datasourceResult.warnings.push(...payloadTestResults.warnings);
  } else {
    datasourceResult.warnings.push('No testPayload.payloadTemplate found - skipping field mapping and metadata schema tests');
  }

  return datasourceResult;
}

/**
 * Runs unit tests for external system (local validation, no API calls)
 * @async
 * @function testExternalSystem
 * @param {string} appName - Application name
 * @param {Object} options - Test options
 * @param {string} [options.datasource] - Test specific datasource only
 * @param {boolean} [options.verbose] - Show detailed validation output
 * @returns {Promise<Object>} Test results
 * @throws {Error} If testing fails
 */
/**
 * Initializes test results object
 * @function initializeTestResults
 * @returns {Object} Initial test results
 */

async function testExternalSystem(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  try {
    logger.log(chalk.blue(`\n🧪 Running unit tests for: ${appName}`));

    // Load files
    const { variables: _variables, systemFiles, datasourceFiles } = await loadExternalSystemFiles(appName);

    const results = initializeTestResults();

    validateSystemFilesForTest(systemFiles, results);
    validateDatasourceFilesForTest(datasourceFiles, systemFiles, results, options, validateSingleDatasource, determineDatasourcesToTest);

    return results;
  } catch (error) {
    // Preserve original error message for better test compatibility
    // Check for various "not found" error patterns
    if (error.message.includes('not found') ||
        error.message.includes('System file') ||
        error.message.includes('system.json not found') ||
        error.message.includes('datasource') && error.message.includes('not found')) {
      throw error;
    }
    throw new Error(`Failed to run unit tests: ${error.message}`);
  }
}

/**
 * Retries API call with exponential backoff
 * @async
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} backoffMs - Initial backoff in milliseconds
 * @returns {Promise<*>} Function result
 */

/**
 * Setup authentication and get dataplane URL for integration tests
 * @async
 * @param {string} appName - Application name
 * @param {Object} options - Test options
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Object with authConfig and dataplaneUrl
 * @throws {Error} If authentication fails
 */

/**
 * Determine which datasources to test
 * @param {Array} datasourceFiles - All datasource files
 * @param {string} [datasourceFilter] - Optional datasource filter
 * @returns {Array} Filtered datasource files
 * @throws {Error} If no datasources found
 */
function determineDatasourcesToTest(datasourceFiles, datasourceFilter) {
  const datasourcesToTest = datasourceFilter
    ? datasourceFiles.filter(ds => ds.data.key === datasourceFilter || path.basename(ds.path).includes(datasourceFilter))
    : datasourceFiles;

  if (datasourcesToTest.length === 0) {
    throw new Error('No datasources found to test');
  }

  return datasourcesToTest;
}

/**
 * Runs integration tests via dataplane pipeline API
 * @async
 * @function testExternalSystemIntegration
 * @param {string} appName - Application name
 * @param {Object} options - Test options
 * @param {string} [options.datasource] - Test specific datasource only
 * @param {string} [options.payload] - Path to custom test payload file
 * @param {string} [options.environment] - Environment (dev, tst, pro)
 * @param {string} [options.controller] - Controller URL
 * @param {boolean} [options.verbose] - Show detailed test output
 * @param {number} [options.timeout] - Request timeout in milliseconds
 * @returns {Promise<Object>} Integration test results
 * @throws {Error} If testing fails
 */
/**
 * Prepares integration test environment
 * @async
 * @function prepareIntegrationTestEnvironment
 * @param {string} appName - Application name
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Object with systemKey, authConfig, dataplaneUrl, datasourcesToTest, customPayload
 */
async function prepareIntegrationTestEnvironment(appName, options) {
  const { variables: _variables, systemFiles, datasourceFiles } = await loadExternalSystemFiles(appName);

  if (systemFiles.length === 0) {
    throw new Error('No system files found');
  }

  const systemKey = systemFiles[0].data.key;

  // Setup authentication and dataplane URL
  const config = await getConfig();
  const { authConfig, dataplaneUrl } = await setupIntegrationTestAuth(appName, options, config);

  // Determine datasources to test
  const datasourcesToTest = determineDatasourcesToTest(datasourceFiles, options.datasource);

  // Load custom payload if provided
  const customPayload = await testHelpers.loadCustomPayload(options.payload);

  return { systemKey, authConfig, dataplaneUrl, datasourcesToTest, customPayload };
}

async function testExternalSystemIntegration(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  try {
    logger.log(chalk.blue(`\n🔗 Running integration tests for: ${appName}`));

    const { systemKey, authConfig, dataplaneUrl, datasourcesToTest, customPayload } = await prepareIntegrationTestEnvironment(appName, options);

    const results = {
      success: true,
      systemKey,
      datasourceResults: []
    };

    // Test each datasource
    for (const datasourceFile of datasourcesToTest) {
      const datasourceResult = await testSingleDatasourceIntegration(
        datasourceFile,
        systemKey,
        dataplaneUrl,
        authConfig,
        customPayload,
        options
      );

      if (!datasourceResult.success && !datasourceResult.skipped) {
        results.success = false;
      }

      results.datasourceResults.push(datasourceResult);
    }

    return results;
  } catch (error) {
    throw new Error(`Failed to run integration tests: ${error.message}`);
  }
}

module.exports = {
  testExternalSystem,
  testExternalSystemIntegration,
  displayTestResults,
  displayIntegrationTestResults,
  retryApiCall
};
