/**
 * External System Download Module
 *
 * Downloads full running manifest from dataplane and splits it into component files
 * using split-json. The dataplane GET /api/v1/external/systems/{systemKey}/config
 * returns { application, dataSources, version } in pipeline format. Supports legacy
 * responses where datasources are inline in application.configuration.dataSources.
 *
 * Process: validate key → auth + dataplane (Bearer required) → GET full manifest →
 * validate → build deploy JSON (augments configuration with auth KV_* for env.template) →
 * write deploy JSON → splitDeployJson (merge env.template if exists; README overwrite per
 * prompt or --force) → ensure placeholder secrets from env.template → convert to JSON if
 * --format json.
 *
 * @fileoverview External system download functionality for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 * @see docs/commands/external-integration.md#aifabrix-download-system-key
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { getExternalSystemConfig } = require('../api/external-systems.api');
const { getDeploymentAuth, requireBearerForDataplanePipeline } = require('../utils/token-manager');
const { getConfig } = require('../core/config');
const { getIntegrationPath } = require('../utils/paths');
const { retemplateConfigurationForDownload } = require('../utils/configuration-env-resolver');
const logger = require('../utils/logger');
const { resolveControllerUrl } = require('../utils/controller-url');
const generator = require('../generator');

/**
 * Validates system type from downloaded application
 * @param {Object} application - External system configuration
 * @returns {string} System type (openapi, mcp, custom)
 * @throws {Error} If system type is invalid
 */
function validateSystemType(application) {
  if (!application || typeof application !== 'object') {
    throw new Error('Application configuration is required');
  }

  const validTypes = ['openapi', 'mcp', 'custom'];
  const systemType = application.type;

  if (!systemType || !validTypes.includes(systemType)) {
    throw new Error(`Invalid system type: ${systemType}. Must be one of: ${validTypes.join(', ')}`);
  }

  return systemType;
}

/**
 * Validates downloaded data structure before writing files
 * @param {Object} application - External system configuration
 * @param {Array} dataSources - Array of datasource configurations
 * @throws {Error} If validation fails
 */
/**
 * Validates application configuration
 * @function validateApplicationConfig
 * @param {Object} application - Application configuration
 * @throws {Error} If validation fails
 */
function validateApplicationConfig(application) {
  if (!application || typeof application !== 'object') {
    throw new Error('Application configuration is required');
  }
  if (!application.key || typeof application.key !== 'string') {
    throw new Error('Application key is required');
  }
}

/**
 * Validates datasource configuration
 * @function validateDatasourceConfig
 * @param {Object} datasource - Datasource configuration
 * @param {string} applicationKey - Application key
 * @throws {Error} If validation fails
 */
function validateDatasourceConfig(datasource, applicationKey) {
  if (!datasource.key || typeof datasource.key !== 'string') {
    throw new Error('Datasource key is required for all datasources');
  }
  if (!datasource.systemKey || typeof datasource.systemKey !== 'string') {
    throw new Error('Datasource systemKey is required for all datasources');
  }
  if (datasource.systemKey !== applicationKey) {
    throw new Error(`Datasource systemKey (${datasource.systemKey}) does not match application key (${applicationKey})`);
  }
}

function validateDownloadedData(application, dataSources) {
  validateApplicationConfig(application);

  if (!Array.isArray(dataSources)) {
    throw new Error('DataSources must be an array');
  }

  for (const datasource of dataSources) {
    validateDatasourceConfig(datasource, application.key);
  }
}

/**
 * Setup authentication and get dataplane URL
 * @async
 * @param {string} systemKey - System key
 * @param {Object} options - Download options
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Object with authConfig and dataplaneUrl
 * @throws {Error} If authentication fails
 */
async function setupAuthenticationAndDataplane(systemKey, _options, _config) {
  const { resolveEnvironment } = require('../core/config');
  const environment = await resolveEnvironment();
  const controllerUrl = await resolveControllerUrl();
  const authConfig = await getDeploymentAuth(controllerUrl, environment, systemKey);

  requireBearerForDataplanePipeline(authConfig);
  if (!authConfig.token) {
    throw new Error('Authentication required. Run "aifabrix login" or "aifabrix app register" first.');
  }

  const { resolveDataplaneUrl } = require('../utils/dataplane-resolver');
  logger.log(chalk.blue('🌐 Resolving dataplane URL...'));
  const dataplaneUrl = await resolveDataplaneUrl(controllerUrl, environment, authConfig);
  logger.log(chalk.green(`✓ Dataplane URL: ${dataplaneUrl}`));

  return { authConfig, dataplaneUrl };
}

/**
 * Download full running manifest from dataplane
 * GET /api/v1/external/systems/{systemKey}/config returns
 * { application, dataSources, version } in pipeline format.
 *
 * @async
 * @param {string} dataplaneUrl - Dataplane URL
 * @param {string} systemKey - System key
 * @param {Object} authConfig - Authentication configuration
 * @returns {Promise<{application: Object, dataSources: Array, version?: string}>} Full manifest
 * @throws {Error} If download fails
 */
async function downloadFullManifest(dataplaneUrl, systemKey, authConfig) {
  logger.log(chalk.blue(`📡 Downloading full manifest: ${systemKey}`));
  const response = await getExternalSystemConfig(dataplaneUrl, systemKey, authConfig);

  if (!response.success || !response.data) {
    throw new Error(`Failed to download system configuration: ${response.error || response.formattedError || 'Unknown error'}`);
  }

  const downloadData = response.data.data || response.data;
  let application = downloadData.application;
  let dataSources = downloadData.dataSources || [];
  const version = downloadData.version;

  // Legacy: datasources inline in application.configuration.dataSources
  if (!application && downloadData.configuration) {
    application = downloadData;
  }
  if (application && application.configuration && Array.isArray(application.configuration.dataSources)) {
    dataSources = [...dataSources, ...application.configuration.dataSources];
    const { dataSources: _inlineDataSources, ...configWithoutDataSources } = application.configuration;
    application = { ...application, configuration: configWithoutDataSources };
  }

  if (!application) {
    throw new Error('Application configuration not found in download response');
  }

  return { application, dataSources, version };
}

/**
 * Derives env variable name from system key and security key (e.g. KV_HUBSPOT_CLIENTID).
 * @param {string} systemKey - System key (e.g. 'hubspot')
 * @param {string} securityKey - Security key (e.g. 'clientId')
 * @returns {string} Variable name
 */
function deriveAuthVarName(systemKey, securityKey) {
  const safeKey = (systemKey || '').toUpperCase().replace(/-/g, '_');
  const safeSec = (securityKey || '').replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  return `KV_${safeKey}_${safeSec}`;
}

/**
 * Collects kv:// paths already present in configuration array.
 * @param {Array} config - Configuration array
 * @returns {Set<string>} Set of kv paths
 */
function collectExistingKvPaths(config) {
  const paths = new Set();
  for (const item of config) {
    if (!item || !item.value) continue;
    const val = String(item.value).trim();
    if (val.startsWith('kv://')) paths.add(val);
    else if (item.location === 'keyvault') paths.add(`kv://${val}`);
  }
  return paths;
}

/**
 * Augments system.configuration with entries for authentication.security kv paths
 * so that extractEnvTemplate produces env.template that passes validateAuthKvCoverage.
 * @param {Object} system - System config (mutated)
 */
function augmentConfigurationWithAuthSecrets(system) {
  if (!system || typeof system !== 'object') return;
  const security = system.authentication?.security;
  if (!security || typeof security !== 'object') return;
  const config = Array.isArray(system.configuration) ? [...system.configuration] : [];
  const existingPaths = collectExistingKvPaths(config);
  const systemKey = system.key || '';
  for (const [key, val] of Object.entries(security)) {
    if (typeof val !== 'string' || !/^kv:\/\/.+/.test(val)) continue;
    if (existingPaths.has(val)) continue;
    config.push({
      name: deriveAuthVarName(systemKey, key),
      value: val.replace(/^kv:\/\//, ''),
      location: 'keyvault',
      required: true
    });
  }
  system.configuration = config;
}

/**
 * Build deploy JSON from full running manifest (split-json compatible).
 * @param {Object} application - System config from dataplane
 * @param {Array} dataSources - Inline datasource configs
 * @param {string} [version] - Optional version
 * @returns {Object} Deploy JSON object for splitDeployJson
 */
function buildDeployJsonFromManifest(application, dataSources, version) {
  const dataSourcesKeys = Array.isArray(dataSources)
    ? dataSources.map(ds => (ds && ds.key) ? ds.key : ds)
    : [];
  const system = { ...application, dataSources: application.dataSources || dataSourcesKeys };
  augmentConfigurationWithAuthSecrets(system);
  const deploy = { system, dataSources };
  if (version) deploy.version = version;
  return deploy;
}

/**
 * Validate system key format
 * @param {string} systemKey - System key to validate
 * @throws {Error} If system key format is invalid
 */
function validateSystemKeyFormat(systemKey) {
  if (!systemKey || typeof systemKey !== 'string') {
    throw new Error('System key is required and must be a string');
  }
  if (!/^[a-z0-9-_]+$/.test(systemKey)) {
    throw new Error('System key must contain only lowercase letters, numbers, hyphens, and underscores');
  }
}

/**
 * Handle dry run mode
 * @param {string} systemKey - System key
 * @param {string} dataplaneUrl - Dataplane URL
 */
function handleDryRun(systemKey, dataplaneUrl) {
  logger.log(chalk.yellow('🔍 Dry run mode - would download from:'));
  logger.log(chalk.gray(`  ${dataplaneUrl}/api/v1/external/systems/${systemKey}/config`));
  logger.log(chalk.yellow('\nWould create (via split-json):'));
  logger.log(chalk.gray(`  integration/${systemKey}/${systemKey}-deploy.json`));
  logger.log(chalk.gray(`  integration/${systemKey}/application.yaml`));
  logger.log(chalk.gray(`  integration/${systemKey}/${systemKey}-system.yaml`));
  logger.log(chalk.gray(`  integration/${systemKey}/env.template`));
  logger.log(chalk.gray(`  integration/${systemKey}/README.md`));
}

/**
 * Validate and log downloaded data
 * @param {Object} application - Application configuration
 * @param {Array} dataSources - Array of datasource configurations
 * @returns {string} System type
 */
function validateAndLogDownloadedData(application, dataSources) {
  logger.log(chalk.blue('🔍 Validating downloaded data...'));
  validateDownloadedData(application, dataSources);
  const systemType = validateSystemType(application);
  logger.log(chalk.green(`✓ System type: ${systemType}`));
  logger.log(chalk.green(`✓ Found ${dataSources.length} datasource(s)`));
  return systemType;
}

/**
 * Prompts user: "Do you want to replace README.md? (yes/no)"
 * @returns {Promise<boolean>} True if user answers yes
 */
function promptReplaceReadme() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(chalk.yellow('README.md already exists. Do you want to replace it? (yes/no) '), answer => {
      rl.close();
      const normalized = (answer || '').trim().toLowerCase();
      resolve(normalized === 'yes' || normalized === 'y');
    });
  });
}

/**
 * Resolves split options for download: merge env.template if it exists, prompt for README replace if it exists (unless force).
 * @param {string} finalPath - Integration directory path
 * @param {Object} [options] - Download options
 * @param {boolean} [options.force] - If true, overwrite README.md without prompting
 * @returns {Promise<{ mergeEnvTemplate: boolean, overwriteReadme: boolean }>}
 */
async function resolveDownloadSplitOptions(finalPath, options = {}) {
  const opts = { mergeEnvTemplate: false, overwriteReadme: true };
  if (!fsSync.existsSync(finalPath)) return opts;
  const envPath = path.join(finalPath, 'env.template');
  const readmePath = path.join(finalPath, 'README.md');
  if (fsSync.existsSync(envPath)) opts.mergeEnvTemplate = true;
  if (fsSync.existsSync(readmePath)) {
    if (options.force) {
      opts.overwriteReadme = true;
    } else {
      opts.overwriteReadme = await promptReplaceReadme();
      if (!opts.overwriteReadme) logger.log(chalk.gray('  Keeping existing README.md'));
    }
  }
  return opts;
}

/**
 * Re-templates system file configuration from env.template when present (mutates file on disk).
 * @param {string} systemKey - System key
 * @param {string} systemFilePath - Path to *-system.yaml
 * @returns {Promise<void>}
 */
async function applyRetemplateToSystemFile(systemKey, systemFilePath) {
  if (!systemFilePath || !fsSync.existsSync(systemFilePath)) return;
  const systemContent = await fs.readFile(systemFilePath, 'utf8');
  const systemObj = yaml.load(systemContent);
  if (!Array.isArray(systemObj?.configuration)) return;
  const applied = await retemplateConfigurationForDownload(systemKey, systemObj.configuration);
  if (applied) {
    await fs.writeFile(systemFilePath, yaml.dump(systemObj, { indent: 2, lineWidth: -1 }), 'utf8');
  }
}

/**
 * Write deploy JSON and split into component files
 * @async
 * @param {string} systemKey - System key
 * @param {Object} manifest - Full manifest { application, dataSources, version }
 * @param {Object} [splitOptions] - Options for split (mergeEnvTemplate, overwriteReadme)
 * @returns {Promise<string>} Final destination path
 * @throws {Error} If processing fails
 */
async function processDownloadedSystem(systemKey, manifest, splitOptions = {}) {
  const { application, dataSources, version } = manifest;
  const finalPath = getIntegrationPath(systemKey);

  logger.log(chalk.blue(`📁 Creating directory: ${finalPath}`));
  await fs.mkdir(finalPath, { recursive: true });

  const deployJson = buildDeployJsonFromManifest(application, dataSources, version);
  const deployJsonPath = path.join(finalPath, `${systemKey}-deploy.json`);
  await fs.writeFile(deployJsonPath, JSON.stringify(deployJson, null, 2), 'utf8');
  logger.log(chalk.green(`✓ Created: ${path.relative(process.cwd(), deployJsonPath)}`));

  logger.log(chalk.blue('📂 Splitting deploy JSON into component files...'));
  const splitResult = await generator.splitDeployJson(deployJsonPath, finalPath, splitOptions);
  await applyRetemplateToSystemFile(systemKey, splitResult.systemFile);

  try {
    const secretsEnsure = require('../core/secrets-ensure');
    await secretsEnsure.ensureSecretsFromEnvTemplate(path.join(finalPath, 'env.template'), { emptyValuesForCredentials: true });
  } catch (err) {
    if (err.code !== 'ENOENT') logger.warn(`Could not ensure integration placeholder secrets: ${err.message}`);
  }

  return finalPath;
}

/**
 * Display download success message
 * @param {string} systemKey - System key
 * @param {string} finalPath - Final destination path
 * @param {number} datasourceCount - Number of datasources
 */
function displayDownloadSuccess(systemKey, finalPath, datasourceCount) {
  logger.log(chalk.green('\n✔ External system downloaded successfully!'));
  logger.log(chalk.blue(`Location: ${finalPath}`));
  logger.log(chalk.blue(`System: ${systemKey}`));
  logger.log(chalk.blue(`Datasources: ${datasourceCount}`));
}

/**
 * Downloads external system from dataplane to local development structure
 * @async
 * @function downloadExternalSystem
 * @param {string} systemKey - System key or ID
 * @param {Object} options - Download options
 * @param {string} [options.format] - Output format: 'yaml' (default) or 'json' (runs convert after split)
 * @param {string} [options.environment] - Environment (dev, tst, pro)
 * @param {string} [options.controller] - Controller URL
 * @param {boolean} [options.dryRun] - Show what would be downloaded without actually downloading
 * @param {boolean} [options.force] - Overwrite existing README.md without prompting
 * @returns {Promise<void>} Resolves when download completes
 * @throws {Error} If download fails
 */
async function runConvertToJsonIfRequested(systemKey) {
  const { runConvert } = require('../commands/convert');
  try {
    await runConvert(systemKey, { format: 'json', force: true });
    logger.log(chalk.green('✓ Converted component files to JSON'));
  } catch (convertErr) {
    throw new Error(`Download succeeded but convert to JSON failed: ${convertErr.message}`);
  }
}

async function downloadExternalSystem(systemKey, options = {}) {
  validateSystemKeyFormat(systemKey);

  const format = (options.format || 'yaml').toLowerCase();

  try {
    logger.log(chalk.blue(`\n📥 Downloading external system: ${systemKey}`));

    const config = await getConfig();
    const { authConfig, dataplaneUrl } = await setupAuthenticationAndDataplane(systemKey, options, config);

    if (options.dryRun) {
      handleDryRun(systemKey, dataplaneUrl);
      return;
    }

    const manifest = await downloadFullManifest(dataplaneUrl, systemKey, authConfig);
    validateAndLogDownloadedData(manifest.application, manifest.dataSources);

    const finalPath = getIntegrationPath(systemKey);
    const splitOptions = await resolveDownloadSplitOptions(finalPath, options);
    await processDownloadedSystem(systemKey, manifest, splitOptions);

    if (format === 'json') {
      await runConvertToJsonIfRequested(systemKey);
    }

    displayDownloadSuccess(systemKey, finalPath, manifest.dataSources.length);
  } catch (error) {
    throw new Error(`Failed to download external system: ${error.message}`);
  }
}

module.exports = {
  downloadExternalSystem,
  validateSystemType,
  validateDownloadedData
};
