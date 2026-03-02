/**
 * @fileoverview Wizard file generator - saves dataplane-generated configurations to files
 * @author AI Fabrix Team
 * @version 2.0.0
 *
 * Standard credential-backed variable names (supplied at runtime from the selected credential;
 * do not list in configuration array): CLIENTID, CLIENTSECRET, TOKENURL, APIKEY, USERNAME,
 * PASSWORD, BASEURL. See docs/external-systems.md and docs/wizard.md.
 */

const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');
const { generateExternalReadmeContent } = require('../utils/external-readme');
const { systemKeyToKvPrefix } = require('../utils/credential-secrets-env');

/**
 * Converts a string to a schema-valid key segment (lowercase letters, numbers, hyphens only).
 * e.g. "recordStorage" -> "record-storage", "documentStorage" -> "document-storage"
 * @param {string} str - Raw entity type or key segment (may be camelCase)
 * @returns {string} Segment matching ^[a-z0-9-]+$
 */
function toKeySegment(str) {
  if (!str || typeof str !== 'string') return 'default';
  const withHyphens = str.replace(/([A-Z])/g, '-$1').toLowerCase();
  const sanitized = withHyphens.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return sanitized || 'default';
}

/**
 * Generate files from dataplane-generated wizard configurations
 * @async
 * @function generateWizardFiles
 * @param {string} appName - Application name
 * @param {Object} systemConfig - System configuration from dataplane
 * @param {Object[]} datasourceConfigs - Array of datasource configurations from dataplane
 * @param {string} systemKey - System key (from dataplane or derived)
 * @returns {Promise<Object>} Object with generated file paths
 * @throws {Error} If file generation fails
 */
/** Extension for format */
const FORMAT_EXT = { yaml: '.yaml', json: '.json' };

/**
 * Writes system config file
 * @async
 * @function writeSystemYamlFile
 * @param {string} appPath - Application path
 * @param {string} finalSystemKey - Final system key
 * @param {Object} systemConfig - System configuration
 * @param {string} [format] - Output format: 'yaml' (default) or 'json'
 * @returns {Promise<string>} System file path
 */
async function writeSystemYamlFile(appPath, finalSystemKey, systemConfig, format = 'yaml') {
  const ext = FORMAT_EXT[format === 'json' ? 'json' : 'yaml'] || '.yaml';
  const systemFileName = `${finalSystemKey}-system${ext}`;
  const systemFilePath = path.join(appPath, systemFileName);
  writeConfigFile(systemFilePath, systemConfig, format === 'json' ? 'json' : 'yaml');
  logger.log(chalk.green(`✓ Generated system file: ${systemFileName}`));
  return systemFilePath;
}

/**
 * Writes datasource config files
 * @async
 * @function writeDatasourceYamlFiles
 * @param {string} appPath - Application path
 * @param {string} finalSystemKey - Final system key
 * @param {Object[]} datasourceConfigs - Array of datasource configurations
 * @param {string} [format] - Output format: 'yaml' (default) or 'json'
 * @returns {Promise<string[]>} Array of datasource file names
 */
async function writeDatasourceYamlFiles(appPath, finalSystemKey, datasourceConfigs, format = 'yaml') {
  const ext = FORMAT_EXT[format === 'json' ? 'json' : 'yaml'] || '.yaml';
  const fmt = format === 'json' ? 'json' : 'yaml';
  const datasourceFileNames = [];
  const usedBaseNames = new Set();
  for (const datasourceConfig of datasourceConfigs) {
    const datasourceKey = datasourceConfig.key || '';
    const datasourceKeyOnly = datasourceKey.includes('-') && datasourceKey.startsWith(`${finalSystemKey}-`)
      ? datasourceKey.substring(finalSystemKey.length + 1)
      : (datasourceConfig.entityType || datasourceConfig.entityKey || datasourceKey.split('-').pop() || 'default');
    const keySegment = toKeySegment(datasourceKeyOnly);
    let baseName = keySegment;
    if (usedBaseNames.has(baseName)) {
      let suffix = 1;
      while (usedBaseNames.has(`${baseName}-${suffix}`)) suffix++;
      baseName = `${baseName}-${suffix}`;
    }
    usedBaseNames.add(baseName);
    const datasourceFileName = `${finalSystemKey}-datasource-${baseName}${ext}`;
    const datasourceFilePath = path.join(appPath, datasourceFileName);
    writeConfigFile(datasourceFilePath, datasourceConfig, fmt);
    datasourceFileNames.push(datasourceFileName);
    logger.log(chalk.green(`✓ Generated datasource file: ${datasourceFileName}`));
  }
  return datasourceFileNames;
}

/**
 * Generates all configuration files
 * @async
 * @function generateConfigFilesForWizard
 * @param {Object} params - Parameters object
 * @param {string} params.appPath - Application path
 * @param {string} params.appName - Application name
 * @param {string} params.finalSystemKey - Final system key
 * @param {string} params.systemFileName - System file name
 * @param {string[]} params.datasourceFileNames - Array of datasource file names
 * @param {Object} params.systemConfig - System configuration
 * @param {Object[]} params.datasourceConfigs - Array of datasource configurations
 * @param {string} [params.aiGeneratedReadme] - Optional AI-generated README content
 * @returns {Promise<Object>} Object with file paths
 */
async function generateConfigFilesForWizard(params) {
  const { appPath, appName, finalSystemKey, systemFileName, datasourceFileNames, systemConfig, datasourceConfigs, aiGeneratedReadme, format } = params;

  // Generate or update application config with externalIntegration block
  const configPath = await generateOrUpdateVariablesYaml({
    appPath,
    appName,
    systemKey: finalSystemKey,
    systemFileName,
    datasourceFileNames,
    systemConfig,
    format: format || 'yaml'
  });

  // Generate env.template with KV_* authentication variables
  await generateEnvTemplate(appPath, systemConfig, finalSystemKey);

  const envTemplatePath = path.join(appPath, 'env.template');
  try {
    const secretsEnsure = require('../core/secrets-ensure');
    await secretsEnsure.ensureSecretsFromEnvTemplate(envTemplatePath, { emptyValuesForCredentials: true });
  } catch (err) {
    if (err.code !== 'ENOENT') logger.warn(`Could not ensure integration placeholder secrets: ${err.message}`);
  }

  // Generate README.md (use AI-generated content if available)
  await generateReadme(appPath, appName, finalSystemKey, systemConfig, datasourceConfigs, aiGeneratedReadme);

  // Generate deployment scripts
  const deployScripts = await generateDeployScripts(appPath, finalSystemKey, systemFileName, datasourceFileNames);

  // Generate deployment manifest (<systemKey>-deploy.json) using controller format
  const { generateControllerManifest, toDeployJsonShape } = require('./external-controller-manifest');
  const manifest = await generateControllerManifest(appName, { appPath });
  const deployJson = toDeployJsonShape(manifest);
  const deployManifestPath = path.join(appPath, `${finalSystemKey}-deploy.json`);
  await fs.writeFile(deployManifestPath, JSON.stringify(deployJson, null, 2), 'utf8');
  logger.log(chalk.green(`✓ Generated deployment manifest: ${finalSystemKey}-deploy.json`));

  return {
    variablesPath: configPath,
    envTemplatePath: path.join(appPath, 'env.template'),
    readmePath: path.join(appPath, 'README.md'),
    applicationSchemaPath: deployManifestPath,
    ...deployScripts
  };
}

async function prepareWizardContext(appName, systemConfig, datasourceConfigs) {
  const appPath = path.join(process.cwd(), 'integration', appName);
  await fs.mkdir(appPath, { recursive: true });
  const finalSystemKey = appName;
  const originalSystemKey = systemConfig.key || finalSystemKey;
  const appDisplayName = appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const updatedSystemConfig = { ...systemConfig, key: finalSystemKey, displayName: appDisplayName };
  const originalPrefix = `${originalSystemKey}-`;
  const updatedDatasourceConfigs = datasourceConfigs.map(ds => {
    let newKey;
    const dsKey = ds.key || '';
    if (dsKey && dsKey.startsWith(originalPrefix)) {
      newKey = `${finalSystemKey}-${dsKey.substring(originalPrefix.length)}`;
    } else {
      const entityType = ds.entityType || ds.entityKey || dsKey.split('-').pop() || 'default';
      const keySegment = toKeySegment(entityType);
      newKey = `${finalSystemKey}-${keySegment}`;
    }
    const entityType = ds.entityType || ds.entityKey || newKey.split('-').pop() || 'default';
    const entityDisplayName = String(entityType).charAt(0).toUpperCase() + String(entityType).slice(1).replace(/-/g, ' ');
    return { ...ds, key: newKey, systemKey: finalSystemKey, displayName: ds.displayName || `${appDisplayName} ${entityDisplayName}` };
  });
  return { appPath, finalSystemKey, updatedSystemConfig, updatedDatasourceConfigs, appDisplayName };
}

async function generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, options = {}) {
  try {
    const { aiGeneratedReadme, format } = options || {};
    const fmt = format === 'json' ? 'json' : 'yaml';
    const ext = FORMAT_EXT[fmt] || '.yaml';
    const { appPath, finalSystemKey, updatedSystemConfig, updatedDatasourceConfigs } = await prepareWizardContext(appName, systemConfig, datasourceConfigs);
    const systemConfigWithDataSourcesKeys = {
      ...updatedSystemConfig,
      dataSources: updatedDatasourceConfigs.map(ds => ds.key)
    };
    const systemFilePath = await writeSystemYamlFile(appPath, finalSystemKey, systemConfigWithDataSourcesKeys, fmt);
    const datasourceFileNames = await writeDatasourceYamlFiles(appPath, finalSystemKey, updatedDatasourceConfigs, fmt);
    const systemFileName = `${finalSystemKey}-system${ext}`;
    const configFiles = await generateConfigFilesForWizard({
      appPath,
      appName,
      finalSystemKey,
      systemFileName,
      datasourceFileNames,
      systemConfig: updatedSystemConfig,
      datasourceConfigs: updatedDatasourceConfigs,
      aiGeneratedReadme,
      format: fmt
    });
    return {
      appPath,
      systemFilePath,
      datasourceFilePaths: datasourceFileNames.map(name => path.join(appPath, name)),
      ...configFiles
    };
  } catch (error) {
    throw new Error(`Failed to generate wizard files: ${error.message}`);
  }
}

function mergeAppAndExternalIntegration(variables, appName, systemFileName, datasourceFileNames, systemConfig) {
  if (!variables.app) {
    variables.app = {
      key: appName,
      displayName: systemConfig.displayName || appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: systemConfig.description || `External system integration for ${appName}`,
      type: 'external',
      version: '1.0.0'
    };
  } else {
    variables.app.version = variables.app.version || '1.0.0';
  }
  if (!variables.deployment) {
    variables.deployment = { controllerUrl: '', environment: 'dev' };
  }
  variables.externalIntegration = {
    schemaBasePath: './',
    systems: [systemFileName],
    dataSources: datasourceFileNames,
    autopublish: true,
    version: systemConfig.version || '1.0.0'
  };
}

/**
 * Generate or update application config with externalIntegration block
 * @async
 * @function generateOrUpdateVariablesYaml
 * @param {Object} params - Parameters object
 * @param {string} params.appPath - Application directory path
 * @param {string} params.appName - Application name
 * @param {string} params.systemFileName - System file name
 * @param {string[]} params.datasourceFileNames - Array of datasource file names
 * @param {Object} params.systemConfig - System configuration
 * @param {string} [params.format] - Output format: 'yaml' (default) or 'json'
 * @returns {Promise<string>} Path to application config file
 * @throws {Error} If generation fails
 */
async function generateOrUpdateVariablesYaml(params) {
  const { appPath, appName, systemFileName, datasourceFileNames, systemConfig, format } = params;
  const fmt = format === 'json' ? 'json' : 'yaml';
  const ext = FORMAT_EXT[fmt] || '.yaml';
  let configPath;
  let variables = {};
  try {
    try {
      configPath = resolveApplicationConfigPath(appPath);
      variables = loadConfigFile(configPath) || {};
    } catch {
      configPath = path.join(appPath, `application${ext}`);
    }
    mergeAppAndExternalIntegration(variables, appName, systemFileName, datasourceFileNames, systemConfig);
    const targetPath = path.join(appPath, `application${ext}`);
    writeConfigFile(targetPath, variables, fmt);
    if (path.normalize(configPath) !== path.normalize(targetPath)) {
      const fsSync = require('fs');
      if (fsSync.existsSync(configPath)) fsSync.unlinkSync(configPath);
    }
    logger.log(chalk.green(`✓ Generated/updated application${ext}`));
    return targetPath;
  } catch (error) {
    throw new Error(`Failed to generate application config: ${error.message}`);
  }
}

/**
 * Adds API key authentication lines with KV_* convention
 * @param {Array<string>} lines - Lines array to append to
 * @param {string} prefix - KV prefix (e.g. HUBSPOT)
 */
function addApiKeyAuthLines(lines, prefix) {
  lines.push('# API Key Authentication');
  lines.push(`KV_${prefix}_APIKEY=`);
  lines.push('');
}

/**
 * Adds OAuth2 authentication lines with KV_* convention
 * @param {Array<string>} lines - Lines array to append to
 * @param {Object} auth - Authentication configuration
 * @param {string} prefix - KV prefix
 */
function addOAuth2AuthLines(lines, auth, prefix) {
  lines.push('# OAuth2 Authentication');
  lines.push(`KV_${prefix}_CLIENTID=`);
  lines.push(`KV_${prefix}_CLIENTSECRET=`);
  if (auth.scope) lines.push(`SCOPE=${auth.scope}`);
  lines.push('');
}

/**
 * Adds bearer token authentication lines with KV_* convention
 * @param {Array<string>} lines - Lines array to append to
 * @param {string} prefix - KV prefix
 */
function addBearerTokenAuthLines(lines, prefix) {
  lines.push('# Bearer Token Authentication');
  lines.push(`KV_${prefix}_BEARERTOKEN=`);
  lines.push('');
}

/**
 * Adds basic authentication lines with KV_* convention
 * @param {Array<string>} lines - Lines array to append to
 * @param {string} prefix - KV prefix
 */
function addBasicAuthLines(lines, prefix) {
  lines.push('# Basic Authentication');
  lines.push(`KV_${prefix}_USERNAME=`);
  lines.push(`KV_${prefix}_PASSWORD=`);
  lines.push('');
}

/**
 * Adds authentication lines based on auth type. Uses KV_<APPKEY>_<VAR> convention.
 * @param {Array<string>} lines - Lines array to append to
 * @param {Object} auth - Authentication configuration
 * @param {string} authType - Authentication type
 * @param {string} systemKey - System key (e.g. hubspot) for KV_ prefix
 */
function addAuthenticationLines(lines, auth, authType, systemKey) {
  const prefix = systemKeyToKvPrefix(systemKey);
  if (!prefix) return;
  if (authType === 'apikey' || authType === 'apiKey') {
    addApiKeyAuthLines(lines, prefix);
  } else if (authType === 'oauth2' || authType === 'oauth') {
    addOAuth2AuthLines(lines, auth || {}, prefix);
  } else if (authType === 'bearer' || authType === 'token') {
    addBearerTokenAuthLines(lines, prefix);
  } else if (authType === 'basic') {
    addBasicAuthLines(lines, prefix);
  }
}

/**
 * Adds base URL lines if present
 * @function addBaseUrlLines
 * @param {Array<string>} lines - Lines array to append to
 * @param {Object} systemConfig - System configuration
 */
function addBaseUrlLines(lines, systemConfig) {
  if (systemConfig.baseUrl || systemConfig.baseURL) {
    lines.push('# API Base URL');
    lines.push(`BASEURL=${systemConfig.baseUrl || systemConfig.baseURL}`);
    lines.push('');
  }
}

/**
 * Generate env.template with KV_* authentication variables
 * @async
 * @function generateEnvTemplate
 * @param {string} appPath - Application directory path
 * @param {Object} systemConfig - System configuration (must have key for systemKey)
 * @param {string} [finalSystemKey] - Final system key for KV_ prefix (default: systemConfig.key)
 * @throws {Error} If generation fails
 */
async function generateEnvTemplate(appPath, systemConfig, finalSystemKey) {
  try {
    const envTemplatePath = path.join(appPath, 'env.template');
    const systemKey = finalSystemKey || systemConfig?.key;
    const lines = ['# Environment variables for external system integration', '# Use KV_* for credential push (aifabrix credential push)', ''];

    const auth = systemConfig?.authentication || systemConfig?.auth || {};
    const authType = auth.type || auth.authType || 'apikey';

    addAuthenticationLines(lines, auth, authType, systemKey);
    addBaseUrlLines(lines, systemConfig);

    await fs.writeFile(envTemplatePath, lines.join('\n'), 'utf8');
    logger.log(chalk.green('✓ Generated env.template'));
  } catch (error) {
    throw new Error(`Failed to generate env.template: ${error.message}`);
  }
}

/**
 * Generate deployment script (deploy.js) from template
 * @async
 * @function generateDeployScripts
 * @param {string} appPath - Application directory path
 * @param {string} systemKey - System key
 * @param {string} systemFileName - System file name
 * @param {string[]} datasourceFileNames - Array of datasource file names
 * @returns {Promise<Object>} Object with deployJsPath
 * @throws {Error} If generation fails
 */
const templatesExternalDir = path.join(__dirname, '..', '..', 'templates', 'external-system');

async function writeDeployScriptFromTemplate(templateName, outputPath, context) {
  const templatePath = path.join(templatesExternalDir, templateName);
  const content = Handlebars.compile(await fs.readFile(templatePath, 'utf8'))(context);
  await fs.writeFile(outputPath, content, 'utf8');
  logger.log(chalk.green(`✓ Generated ${path.basename(outputPath)}`));
}

async function generateDeployScripts(appPath, systemKey, systemFileName, datasourceFileNames) {
  try {
    const allJsonFiles = [systemFileName, ...datasourceFileNames];
    const context = { systemKey, allJsonFiles, datasourceFileNames };

    await writeDeployScriptFromTemplate('deploy.js.hbs', path.join(appPath, 'deploy.js'), context);

    return {
      deployJsPath: path.join(appPath, 'deploy.js')
    };
  } catch (error) {
    throw new Error(`Failed to generate deployment scripts: ${error.message}`);
  }
}

/**
 * Generate README.md with basic documentation
 * @async
 * @function generateReadme
 * @param {string} appPath - Application directory path
 * @param {string} appName - Application name
 * @param {string} systemKey - System key
 * @param {Object} systemConfig - System configuration
 * @param {Object[]} datasourceConfigs - Array of datasource configurations
 * @param {string} [aiGeneratedContent] - Optional AI-generated README content from dataplane
 * @throws {Error} If generation fails
 */
async function generateReadme(appPath, appName, systemKey, systemConfig, datasourceConfigs, aiGeneratedContent) {
  try {
    const readmePath = path.join(appPath, 'README.md');

    // Use AI-generated content if available, otherwise generate basic README
    if (aiGeneratedContent) {
      await fs.writeFile(readmePath, aiGeneratedContent, 'utf8');
      logger.log(chalk.green('✓ Generated README.md (AI-generated from dataplane)'));
      return;
    }

    const datasources = (Array.isArray(datasourceConfigs) ? datasourceConfigs : []).map((ds, index) => {
      const entityType = ds.entityType || ds.entityKey || ds.key?.split('-').pop() || `datasource${index + 1}`;
      const keySegment = toKeySegment(entityType);
      const datasourceKey = ds.key || `${systemKey}-${keySegment}`;
      const datasourceKeyOnly = datasourceKey.includes('-') && datasourceKey.startsWith(`${systemKey}-`)
        ? datasourceKey.substring(systemKey.length + 1)
        : keySegment;
      return {
        entityType,
        displayName: ds.displayName || ds.name || ds.key || `Datasource ${index + 1}`,
        fileName: `${systemKey}-datasource-${datasourceKeyOnly}.yaml`
      };
    });

    const readmeContent = generateExternalReadmeContent({
      appName,
      systemKey,
      systemType: systemConfig.type || systemConfig.systemType,
      displayName: systemConfig.displayName,
      description: systemConfig.description,
      datasources
    });

    await fs.writeFile(readmePath, readmeContent, 'utf8');
    logger.log(chalk.green('✓ Generated README.md (template)'));
  } catch (error) {
    throw new Error(`Failed to generate README.md: ${error.message}`);
  }
}

module.exports = {
  generateWizardFiles,
  generateDeployScripts
};

