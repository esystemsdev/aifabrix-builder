/**
 * @fileoverview Wizard file generator - saves dataplane-generated configurations to files
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const Handlebars = require('handlebars');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { generateExternalReadmeContent } = require('../utils/external-readme');

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
/**
 * Writes system JSON file
 * @async
 * @function writeSystemJsonFile
 * @param {string} appPath - Application path
 * @param {string} finalSystemKey - Final system key
 * @param {Object} systemConfig - System configuration
 * @returns {Promise<string>} System file path
 */
async function writeSystemJsonFile(appPath, finalSystemKey, systemConfig) {
  const systemFileName = `${finalSystemKey}-system.json`;
  const systemFilePath = path.join(appPath, systemFileName);
  await fs.writeFile(systemFilePath, JSON.stringify(systemConfig, null, 2), 'utf8');
  logger.log(chalk.green(`✓ Generated system file: ${systemFileName}`));
  return systemFilePath;
}

/**
 * Writes datasource JSON files
 * @async
 * @function writeDatasourceJsonFiles
 * @param {string} appPath - Application path
 * @param {string} finalSystemKey - Final system key
 * @param {Object[]} datasourceConfigs - Array of datasource configurations
 * @returns {Promise<string[]>} Array of datasource file names
 */
async function writeDatasourceJsonFiles(appPath, finalSystemKey, datasourceConfigs) {
  const datasourceFileNames = [];
  for (const datasourceConfig of datasourceConfigs) {
    const entityType = datasourceConfig.entityType || datasourceConfig.entityKey || datasourceConfig.key?.split('-').pop() || 'default';
    const keySegment = toKeySegment(entityType);
    const datasourceKey = datasourceConfig.key || `${finalSystemKey}-${keySegment}`;
    // Extract datasource key (remove system key prefix if present); use normalized segment for filename
    const datasourceKeyOnly = datasourceKey.includes('-') && datasourceKey.startsWith(`${finalSystemKey}-`)
      ? datasourceKey.substring(finalSystemKey.length + 1)
      : keySegment;
    const datasourceFileName = `${finalSystemKey}-datasource-${datasourceKeyOnly}.json`;
    const datasourceFilePath = path.join(appPath, datasourceFileName);
    await fs.writeFile(datasourceFilePath, JSON.stringify(datasourceConfig, null, 2), 'utf8');
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
  const { appPath, appName, finalSystemKey, systemFileName, datasourceFileNames, systemConfig, datasourceConfigs, aiGeneratedReadme } = params;

  // Generate or update variables.yaml with externalIntegration block
  await generateOrUpdateVariablesYaml({
    appPath,
    appName,
    systemKey: finalSystemKey,
    systemFileName,
    datasourceFileNames,
    systemConfig
  });

  // Generate env.template with authentication variables
  await generateEnvTemplate(appPath, systemConfig);

  // Generate README.md (use AI-generated content if available)
  await generateReadme(appPath, appName, finalSystemKey, systemConfig, datasourceConfigs, aiGeneratedReadme);

  // Generate deployment scripts
  const deployScripts = await generateDeployScripts(appPath, finalSystemKey, systemFileName, datasourceFileNames);

  // Generate deployment manifest (<systemKey>-deploy.json) using controller format
  const { generateControllerManifest } = require('./external-controller-manifest');
  const manifest = await generateControllerManifest(appName, { appPath });
  const deployManifestPath = path.join(appPath, `${finalSystemKey}-deploy.json`);
  await fs.writeFile(deployManifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  logger.log(chalk.green(`✓ Generated deployment manifest: ${finalSystemKey}-deploy.json`));

  return {
    variablesPath: path.join(appPath, 'variables.yaml'),
    envTemplatePath: path.join(appPath, 'env.template'),
    readmePath: path.join(appPath, 'README.md'),
    applicationSchemaPath: deployManifestPath,
    ...deployScripts
  };
}

async function generateWizardFiles(appName, systemConfig, datasourceConfigs, systemKey, options = {}) {
  try {
    const { aiGeneratedReadme } = options || {};
    // Determine app path (integration directory for external systems)
    const appPath = path.join(process.cwd(), 'integration', appName);

    // Create directory if it doesn't exist
    await fs.mkdir(appPath, { recursive: true });

    // Use appName as the system key to ensure consistent naming
    // Priority: appName > systemKey parameter > systemConfig.key
    const finalSystemKey = appName;

    // Generate displayName from appName (e.g., "my-hubspot" -> "My Hubspot")
    const appDisplayName = appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Update system config to use the appName as key and displayName
    const updatedSystemConfig = {
      ...systemConfig,
      key: finalSystemKey,
      displayName: appDisplayName
    };

    // Update datasource configs to use appName-based keys and systemKey (key must match ^[a-z0-9-]+$)
    const updatedDatasourceConfigs = datasourceConfigs.map(ds => {
      const entityType = ds.entityType || ds.entityKey || ds.key?.split('-').pop() || 'default';
      const keySegment = toKeySegment(entityType);
      const entityDisplayName = entityType.charAt(0).toUpperCase() + entityType.slice(1).replace(/-/g, ' ');
      return {
        ...ds,
        key: `${finalSystemKey}-${keySegment}`,
        systemKey: finalSystemKey,
        displayName: `${appDisplayName} ${entityDisplayName}`
      };
    });

    // Write system and datasource JSON files
    const systemFilePath = await writeSystemJsonFile(appPath, finalSystemKey, updatedSystemConfig);
    const datasourceFileNames = await writeDatasourceJsonFiles(appPath, finalSystemKey, updatedDatasourceConfigs);

    // Generate configuration files
    const systemFileName = `${finalSystemKey}-system.json`;
    const configFiles = await generateConfigFilesForWizard({
      appPath,
      appName,
      finalSystemKey,
      systemFileName,
      datasourceFileNames,
      systemConfig: updatedSystemConfig,
      datasourceConfigs: updatedDatasourceConfigs,
      aiGeneratedReadme
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

/**
 * Generate or update variables.yaml with externalIntegration block
 * @async
 * @function generateOrUpdateVariablesYaml
 * @param {Object} params - Parameters object
 * @param {string} params.appPath - Application directory path
 * @param {string} params.appName - Application name
 * @param {string} params.systemKey - System key
 * @param {string} params.systemFileName - System file name
 * @param {string[]} params.datasourceFileNames - Array of datasource file names
 * @param {Object} params.systemConfig - System configuration
 * @throws {Error} If generation fails
 */
async function generateOrUpdateVariablesYaml(params) {
  const { appPath, appName, systemFileName, datasourceFileNames, systemConfig } = params;
  try {
    const variablesPath = path.join(appPath, 'variables.yaml');
    let variables = {};

    // Try to read existing variables.yaml
    try {
      const existingContent = await fs.readFile(variablesPath, 'utf8');
      variables = yaml.load(existingContent) || {};
    } catch (error) {
      // File doesn't exist, create new one
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Set basic app info if not present
    if (!variables.app) {
      variables.app = {
        key: appName,
        displayName: systemConfig.displayName || appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: systemConfig.description || `External system integration for ${appName}`,
        type: 'external'
      };
    }

    // Set deployment config if not present
    if (!variables.deployment) {
      variables.deployment = {
        controllerUrl: '',
        environment: 'dev'
      };
    }

    // Add or update externalIntegration block
    variables.externalIntegration = {
      schemaBasePath: './',
      systems: [systemFileName],
      dataSources: datasourceFileNames,
      autopublish: true,
      version: systemConfig.version || '1.0.0'
    };

    await fs.writeFile(variablesPath, yaml.dump(variables, { indent: 2, lineWidth: 120, noRefs: true }), 'utf8');
    logger.log(chalk.green('✓ Generated/updated variables.yaml'));
  } catch (error) {
    throw new Error(`Failed to generate variables.yaml: ${error.message}`);
  }
}

/**
 * Adds API key authentication lines to env template
 * @function addApiKeyAuthLines
 * @param {Array<string>} lines - Lines array to append to
 */
function addApiKeyAuthLines(lines) {
  lines.push('# API Key Authentication');
  lines.push('API_KEY=kv://secrets/api-key');
  lines.push('');
}

/**
 * Adds OAuth2 authentication lines to env template
 * @function addOAuth2AuthLines
 * @param {Array<string>} lines - Lines array to append to
 * @param {Object} auth - Authentication configuration
 */
function addOAuth2AuthLines(lines, auth) {
  lines.push('# OAuth2 Authentication');
  lines.push('CLIENT_ID=kv://secrets/client-id');
  lines.push('CLIENT_SECRET=kv://secrets/client-secret');
  lines.push('AUTH_URL=kv://secrets/auth-url');
  lines.push('TOKEN_URL=kv://secrets/token-url');
  if (auth.scope) {
    lines.push(`SCOPE=${auth.scope}`);
  }
  lines.push('');
}

/**
 * Adds bearer token authentication lines to env template
 * @function addBearerTokenAuthLines
 * @param {Array<string>} lines - Lines array to append to
 */
function addBearerTokenAuthLines(lines) {
  lines.push('# Bearer Token Authentication');
  lines.push('BEARER_TOKEN=kv://secrets/bearer-token');
  lines.push('');
}

/**
 * Adds basic authentication lines to env template
 * @function addBasicAuthLines
 * @param {Array<string>} lines - Lines array to append to
 */
function addBasicAuthLines(lines) {
  lines.push('# Basic Authentication');
  lines.push('USERNAME=kv://secrets/username');
  lines.push('PASSWORD=kv://secrets/password');
  lines.push('');
}

/**
 * Adds authentication lines based on auth type
 * @function addAuthenticationLines
 * @param {Array<string>} lines - Lines array to append to
 * @param {Object} auth - Authentication configuration
 * @param {string} authType - Authentication type
 */
function addAuthenticationLines(lines, auth, authType) {
  if (authType === 'apikey' || authType === 'apiKey') {
    addApiKeyAuthLines(lines);
  } else if (authType === 'oauth2' || authType === 'oauth') {
    addOAuth2AuthLines(lines, auth);
  } else if (authType === 'bearer' || authType === 'token') {
    addBearerTokenAuthLines(lines);
  } else if (authType === 'basic') {
    addBasicAuthLines(lines);
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
    lines.push(`BASE_URL=${systemConfig.baseUrl || systemConfig.baseURL}`);
    lines.push('');
  }
}

/**
 * Generate env.template with authentication variables
 * @async
 * @function generateEnvTemplate
 * @param {string} appPath - Application directory path
 * @param {Object} systemConfig - System configuration
 * @throws {Error} If generation fails
 */
async function generateEnvTemplate(appPath, systemConfig) {
  try {
    const envTemplatePath = path.join(appPath, 'env.template');
    const lines = ['# Environment variables for external system integration', ''];

    // Extract authentication variables from system config
    const auth = systemConfig.authentication || systemConfig.auth || {};
    const authType = auth.type || auth.authType || 'apikey';

    addAuthenticationLines(lines, auth, authType);
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
        fileName: `${systemKey}-datasource-${datasourceKeyOnly}.json`
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

