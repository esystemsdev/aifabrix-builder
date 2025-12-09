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
const { authenticatedApiCall } = require('./utils/api');
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
    for (const systemFile of systemFiles) {
      const validation = validateAgainstSchema(systemFile.data, externalSystemSchema);
      if (!validation.valid) {
        results.valid = false;
        results.errors.push(`System file ${path.basename(systemFile.path)}: ${validation.errors.join(', ')}`);
      } else {
        results.systemResults.push({
          file: path.basename(systemFile.path),
          valid: true
        });
      }
    }

    // Validate datasource files
    logger.log(chalk.blue('📋 Validating datasource files...'));
    const datasourcesToTest = options.datasource
      ? datasourceFiles.filter(ds => ds.data.key === options.datasource || path.basename(ds.path).includes(options.datasource))
      : datasourceFiles;

    for (const datasourceFile of datasourcesToTest) {
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
      const schemaValidation = validateAgainstSchema(datasource, externalDataSourceSchema);
      if (!schemaValidation.valid) {
        datasourceResult.valid = false;
        datasourceResult.errors.push(...schemaValidation.errors);
        results.valid = false;
      }

      // Validate relationships
      if (systemFiles.length > 0) {
        const systemKey = systemFiles[0].data.key;
        if (datasource.systemKey !== systemKey) {
          datasourceResult.valid = false;
          datasourceResult.errors.push(`systemKey mismatch: expected '${systemKey}', got '${datasource.systemKey}'`);
          results.valid = false;
        }
      }

      // Test with testPayload if available
      if (datasource.testPayload && datasource.testPayload.payloadTemplate) {
        logger.log(chalk.blue(`  Testing datasource: ${datasource.key}`));

        // Validate field mappings
        const fieldMappingResults = validateFieldMappings(datasource, datasource.testPayload);
        datasourceResult.fieldMappingResults = fieldMappingResults;
        if (!fieldMappingResults.valid) {
          datasourceResult.valid = false;
          datasourceResult.errors.push(...fieldMappingResults.errors);
          results.valid = false;
        }
        if (fieldMappingResults.warnings.length > 0) {
          datasourceResult.warnings.push(...fieldMappingResults.warnings);
        }

        // Validate metadata schema
        const metadataSchemaResults = validateMetadataSchema(datasource, datasource.testPayload);
        datasourceResult.metadataSchemaResults = metadataSchemaResults;
        if (!metadataSchemaResults.valid) {
          datasourceResult.valid = false;
          datasourceResult.errors.push(...metadataSchemaResults.errors);
          results.valid = false;
        }
        if (metadataSchemaResults.warnings.length > 0) {
          datasourceResult.warnings.push(...metadataSchemaResults.warnings);
        }

        // Compare with expectedResult if provided
        if (datasource.testPayload.expectedResult && fieldMappingResults.mappedFields) {
          // This would require actual transformation execution, which is complex
          // For now, we just note that expectedResult is present
          if (options.verbose) {
            datasourceResult.warnings.push('expectedResult validation not yet implemented (requires transformation engine)');
          }
        }
      } else {
        datasourceResult.warnings.push('No testPayload.payloadTemplate found - skipping field mapping and metadata schema tests');
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
async function retryApiCall(fn, maxRetries = 3, backoffMs = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Calls pipeline test endpoint
 * @async
 * @param {string} systemKey - System key
 * @param {string} datasourceKey - Datasource key
 * @param {Object} payloadTemplate - Test payload template
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {Object} authConfig - Authentication configuration
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<Object>} Test response
 */
async function callPipelineTestEndpoint(systemKey, datasourceKey, payloadTemplate, dataplaneUrl, authConfig, timeout = 30000) {
  const endpoint = `${dataplaneUrl}/api/v1/pipeline/${systemKey}/${datasourceKey}/test`;

  const response = await retryApiCall(async() => {
    return await authenticatedApiCall(
      endpoint,
      {
        method: 'POST',
        body: JSON.stringify({ payloadTemplate }),
        timeout
      },
      authConfig.token
    );
  });

  if (!response.success || !response.data) {
    throw new Error(`Test endpoint failed: ${response.error || response.formattedError || 'Unknown error'}`);
  }

  return response.data.data || response.data;
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

    // Get authentication
    const config = await getConfig();
    const environment = options.environment || 'dev';
    const controllerUrl = options.controller || config.deployment?.controllerUrl || 'http://localhost:3000';
    const authConfig = await getDeploymentAuth(controllerUrl, environment, appName);

    if (!authConfig.token && !authConfig.clientId) {
      throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
    }

    // Get dataplane URL
    logger.log(chalk.blue('🌐 Getting dataplane URL from controller...'));
    const dataplaneUrl = await getDataplaneUrl(controllerUrl, appName, environment, authConfig);
    logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));

    // Determine datasources to test
    const datasourcesToTest = options.datasource
      ? datasourceFiles.filter(ds => ds.data.key === options.datasource || path.basename(ds.path).includes(options.datasource))
      : datasourceFiles;

    if (datasourcesToTest.length === 0) {
      throw new Error('No datasources found to test');
    }

    const results = {
      success: true,
      systemKey,
      datasourceResults: []
    };

    // Load custom payload if provided
    let customPayload = null;
    if (options.payload) {
      const payloadPath = path.isAbsolute(options.payload) ? options.payload : path.join(process.cwd(), options.payload);
      const payloadContent = await fs.readFile(payloadPath, 'utf8');
      customPayload = JSON.parse(payloadContent);
    }

    // Test each datasource
    for (const datasourceFile of datasourcesToTest) {
      const datasource = datasourceFile.data;
      const datasourceKey = datasource.key;

      logger.log(chalk.blue(`\n📡 Testing datasource: ${datasourceKey}`));

      // Determine payload to use
      let payloadTemplate;
      if (customPayload) {
        payloadTemplate = customPayload;
      } else if (datasource.testPayload && datasource.testPayload.payloadTemplate) {
        payloadTemplate = datasource.testPayload.payloadTemplate;
      } else {
        logger.log(chalk.yellow(`  ⚠ No test payload found for ${datasourceKey}, skipping...`));
        results.datasourceResults.push({
          key: datasourceKey,
          skipped: true,
          reason: 'No test payload available'
        });
        continue;
      }

      try {
        const testResponse = await callPipelineTestEndpoint(
          systemKey,
          datasourceKey,
          payloadTemplate,
          dataplaneUrl,
          authConfig,
          parseInt(options.timeout, 10) || 30000
        );

        const datasourceResult = {
          key: datasourceKey,
          skipped: false,
          success: testResponse.success !== false,
          validationResults: testResponse.validationResults || {},
          fieldMappingResults: testResponse.fieldMappingResults || {},
          endpointTestResults: testResponse.endpointTestResults || {}
        };

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
  callPipelineTestEndpoint,
  retryApiCall
};
