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
const testHelpers = require('./utils/external-system-test-helpers');
const { retryApiCall } = require('./utils/external-system-test-helpers');
const { getDeploymentAuth } = require('./utils/token-manager');
const { getDataplaneUrl } = require('./datasource-deploy');
const { getConfig } = require('./config');
const { detectAppType } = require('./utils/paths');
const externalSystemSchema = require('./schema/external-system.schema.json');
const externalDataSourceSchema = require('./schema/external-datasource.schema.json');
const logger = require('./utils/logger');
const {
  validateFieldMappings,
  validateMetadataSchema,
  validateAgainstSchema
} = require('./utils/external-system-validators');
const {
  displayTestResults,
  displayIntegrationTestResults
} = require('./utils/external-system-display');

/**
 * Loads and validates external system files
 * @async
 * @param {string} appName - Application name
 * @returns {Promise<Object>} Loaded files and validation results
 */
async function loadExternalSystemFiles(appName) {
  const { appPath } = await detectAppType(appName);
  const variablesPath = path.join(appPath, 'variables.yaml');

  // Load variables.yaml
  if (!fsSync.existsSync(variablesPath)) {
    throw new Error(`variables.yaml not found: ${variablesPath}`);
  }

  const variablesContent = await fs.readFile(variablesPath, 'utf8');
  let variables;
  try {
    variables = yaml.load(variablesContent);
  } catch (error) {
    throw new Error(`Invalid YAML syntax in variables.yaml: ${error.message}`);
  }

  if (!variables.externalIntegration) {
    throw new Error('externalIntegration block not found in variables.yaml');
  }

  // Load system file(s)
  const schemaBasePath = variables.externalIntegration.schemaBasePath || './';
  const systemFiles = variables.externalIntegration.systems || [];
  const systemJsonFiles = [];

  for (const systemFile of systemFiles) {
    const systemPath = path.isAbsolute(schemaBasePath)
      ? path.join(schemaBasePath, systemFile)
      : path.join(appPath, schemaBasePath, systemFile);

    if (!fsSync.existsSync(systemPath)) {
      throw new Error(`System file not found: ${systemPath}`);
    }

    const systemContent = await fs.readFile(systemPath, 'utf8');
    let systemJson;
    try {
      systemJson = JSON.parse(systemContent);
    } catch (error) {
      throw new Error(`Invalid JSON syntax in ${systemFile}: ${error.message}`);
    }

    systemJsonFiles.push({ path: systemPath, data: systemJson });
  }

  // Load datasource files
  const datasourceFiles = variables.externalIntegration.dataSources || [];
  const datasourceJsonFiles = [];

  for (const datasourceFile of datasourceFiles) {
    const datasourcePath = path.isAbsolute(schemaBasePath)
      ? path.join(schemaBasePath, datasourceFile)
      : path.join(appPath, schemaBasePath, datasourceFile);

    if (!fsSync.existsSync(datasourcePath)) {
      throw new Error(`Datasource file not found: ${datasourcePath}`);
    }

    const datasourceContent = await fs.readFile(datasourcePath, 'utf8');
    let datasourceJson;
    try {
      datasourceJson = JSON.parse(datasourceContent);
    } catch (error) {
      throw new Error(`Invalid JSON syntax in ${datasourceFile}: ${error.message}`);
    }

    datasourceJsonFiles.push({ path: datasourcePath, data: datasourceJson });
  }

  return {
    variables,
    systemFiles: systemJsonFiles,
    datasourceFiles: datasourceJsonFiles
  };
}

/**
 * Validate system files against schema
 * @param {Array} systemFiles - Array of system file objects
 * @param {Object} externalSystemSchema - External system schema
 * @returns {Object} Validation results
 */
function validateSystemFiles(systemFiles, externalSystemSchema) {
  const systemResults = [];
  let valid = true;
  const errors = [];

  for (const systemFile of systemFiles) {
    const validation = validateAgainstSchema(systemFile.data, externalSystemSchema);
    if (!validation.valid) {
      valid = false;
      errors.push(`System file ${path.basename(systemFile.path)}: ${validation.errors.join(', ')}`);
    } else {
      systemResults.push({
        file: path.basename(systemFile.path),
        valid: true
      });
    }
  }

  return { valid, errors, systemResults };
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
async function testExternalSystem(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  try {
    logger.log(chalk.blue(`\n🧪 Running unit tests for: ${appName}`));

    // Load files
    const { variables: _variables, systemFiles, datasourceFiles } = await loadExternalSystemFiles(appName);

    const results = {
      valid: true,
      errors: [],
      warnings: [],
      systemResults: [],
      datasourceResults: []
    };

    // Validate system files
    logger.log(chalk.blue('📋 Validating system files...'));
    const systemValidation = validateSystemFiles(systemFiles, externalSystemSchema);
    results.valid = systemValidation.valid;
    results.errors.push(...systemValidation.errors);
    results.systemResults = systemValidation.systemResults;

    // Validate datasource files
    logger.log(chalk.blue('📋 Validating datasource files...'));
    const datasourcesToTest = determineDatasourcesToTest(datasourceFiles, options.datasource);
    const systemKey = systemFiles.length > 0 ? systemFiles[0].data.key : null;

    for (const datasourceFile of datasourcesToTest) {
      const datasourceResult = validateSingleDatasource(
        datasourceFile,
        systemKey,
        externalDataSourceSchema,
        options.verbose
      );

      if (!datasourceResult.valid) {
        results.valid = false;
      }

      results.datasourceResults.push(datasourceResult);
    }

    return results;
  } catch (error) {
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
async function setupIntegrationTestAuth(appName, options, config) {
  const environment = options.environment || 'dev';
  const controllerUrl = options.controller || config.deployment?.controllerUrl || 'http://localhost:3000';
  const authConfig = await getDeploymentAuth(controllerUrl, environment, appName);

  if (!authConfig.token && !authConfig.clientId) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
  }

  logger.log(chalk.blue('🌐 Getting dataplane URL from controller...'));
  const dataplaneUrl = await getDataplaneUrl(controllerUrl, appName, environment, authConfig);
  logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));

  return { authConfig, dataplaneUrl };
}

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
async function testExternalSystemIntegration(appName, options = {}) {
  if (!appName || typeof appName !== 'string') {
    throw new Error('App name is required and must be a string');
  }

  try {
    logger.log(chalk.blue(`\n🔗 Running integration tests for: ${appName}`));

    // Load files
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

    const results = {
      success: true,
      systemKey,
      datasourceResults: []
    };

    // Load custom payload if provided
    const customPayload = await testHelpers.loadCustomPayload(options.payload);

    // Test each datasource
    for (const datasourceFile of datasourcesToTest) {
      const datasource = datasourceFile.data;
      const datasourceKey = datasource.key;

      logger.log(chalk.blue(`\n📡 Testing datasource: ${datasourceKey}`));

      // Determine payload to use
      const payloadTemplate = testHelpers.determinePayloadTemplate(datasource, datasourceKey, customPayload);
      if (!payloadTemplate) {
        logger.log(chalk.yellow(`  ⚠ No test payload found for ${datasourceKey}, skipping...`));
        results.datasourceResults.push({
          key: datasourceKey,
          skipped: true,
          reason: 'No test payload available'
        });
        continue;
      }

      try {
        const datasourceResult = await testHelpers.testSingleDatasource({
          systemKey,
          datasourceKey,
          payloadTemplate,
          dataplaneUrl,
          authConfig,
          timeout: parseInt(options.timeout, 10) || 30000
        });

        if (!datasourceResult.success) {
          results.success = false;
        }

        results.datasourceResults.push(datasourceResult);
      } catch (error) {
        results.success = false;
        results.datasourceResults.push({
          key: datasourceKey,
          skipped: false,
          success: false,
          error: error.message
        });
      }
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
