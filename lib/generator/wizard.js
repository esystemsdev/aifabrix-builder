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
const { generateExternalSystemApplicationSchema } = require('./external');

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
  const systemFileName = `${finalSystemKey}-deploy.json`;
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
    const datasourceFileName = `${finalSystemKey}-deploy-${entityType}.json`;
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

  // Generate application-schema.json
  const applicationSchema = await generateExternalSystemApplicationSchema(appName);
  const applicationSchemaPath = path.join(appPath, 'application-schema.json');
  await fs.writeFile(applicationSchemaPath, JSON.stringify(applicationSchema, null, 2), 'utf8');
  logger.log(chalk.green('✓ Generated application-schema.json'));

  return {
    variablesPath: path.join(appPath, 'variables.yaml'),
    envTemplatePath: path.join(appPath, 'env.template'),
    readmePath: path.join(appPath, 'README.md'),
    applicationSchemaPath,
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

    // Extract system key from config if not provided
    const finalSystemKey = systemKey || systemConfig.key || appName;

    // Write system and datasource JSON files
    const systemFilePath = await writeSystemJsonFile(appPath, finalSystemKey, systemConfig);
    const datasourceFileNames = await writeDatasourceJsonFiles(appPath, finalSystemKey, datasourceConfigs);

    // Generate configuration files
    const systemFileName = `${finalSystemKey}-deploy.json`;
    const configFiles = await generateConfigFilesForWizard({
      appPath,
      appName,
      finalSystemKey,
      systemFileName,
      datasourceFileNames,
      systemConfig,
      datasourceConfigs,
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
 * Generate deployment scripts (deploy.sh and deploy.ps1) from templates
 * @async
 * @function generateDeployScripts
 * @param {string} appPath - Application directory path
 * @param {string} systemKey - System key
 * @param {string} systemFileName - System file name
 * @param {string[]} datasourceFileNames - Array of datasource file names
 * @returns {Promise<Object>} Object with script file paths
 * @throws {Error} If generation fails
 */
async function generateDeployScripts(appPath, systemKey, systemFileName, datasourceFileNames) {
  try {
    const allJsonFiles = [systemFileName, ...datasourceFileNames];

    // Load and compile deploy.sh template
    const deployShTemplatePath = path.join(__dirname, '..', '..', 'templates', 'external-system', 'deploy.sh.hbs');
    const deployShTemplateContent = await fs.readFile(deployShTemplatePath, 'utf8');
    const deployShTemplate = Handlebars.compile(deployShTemplateContent);

    // Generate deploy.sh
    const deployShPath = path.join(appPath, 'deploy.sh');
    const deployShContent = deployShTemplate({
      systemKey,
      allJsonFiles,
      datasourceFileNames
    });
    await fs.writeFile(deployShPath, deployShContent, 'utf8');
    await fs.chmod(deployShPath, 0o755); // Make executable
    logger.log(chalk.green('✓ Generated deploy.sh'));

    // Load and compile deploy.ps1 template
    const deployPs1TemplatePath = path.join(__dirname, '..', '..', 'templates', 'external-system', 'deploy.ps1.hbs');
    const deployPs1TemplateContent = await fs.readFile(deployPs1TemplatePath, 'utf8');
    const deployPs1Template = Handlebars.compile(deployPs1TemplateContent);

    // Generate deploy.ps1
    const deployPs1Path = path.join(appPath, 'deploy.ps1');
    const deployPs1Content = deployPs1Template({
      systemKey,
      allJsonFiles,
      datasourceFileNames
    });
    await fs.writeFile(deployPs1Path, deployPs1Content, 'utf8');
    logger.log(chalk.green('✓ Generated deploy.ps1'));

    return {
      deployShPath,
      deployPs1Path
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

    const displayName = systemConfig.displayName || appName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const description = systemConfig.description || `External system integration for ${appName}`;

    const lines = [
      `# ${displayName}`,
      '',
      description,
      '',
      '## Overview',
      '',
      'This integration was created using the AI Fabrix wizard.',
      '',
      '## Files',
      '',
      `- \`${systemKey}-deploy.json\` - External system configuration`,
      ...datasourceConfigs.map((ds, index) => {
        const entityType = ds.entityType || ds.entityKey || ds.key?.split('-').pop() || `datasource${index + 1}`;
        return `- \`${systemKey}-deploy-${entityType}.json\` - Datasource configuration`;
      }),
      '- `variables.yaml` - Application variables and external integration configuration',
      '- `env.template` - Environment variable template',
      '- `application-schema.json` - Single deployment file',
      '- `deploy.sh` - Bash deployment script',
      '- `deploy.ps1` - PowerShell deployment script',
      '',
      '## Deployment',
      '',
      '### Using Deployment Scripts',
      '',
      'You can deploy using the provided scripts:',
      '',
      '**Bash (Linux/macOS):**',
      '```bash',
      './deploy.sh',
      '```',
      '',
      '**PowerShell (Windows):**',
      '```powershell',
      '.\\deploy.ps1',
      '```',
      '',
      'The scripts support environment variables:',
      '- `ENVIRONMENT` - Environment key (default: dev)',
      '- `CONTROLLER` - Controller URL (default: http://localhost:3000)',
      '- `RUN_TESTS` - Set to "true" to run integration tests after deployment',
      '',
      '**Example:**',
      '```bash',
      'ENVIRONMENT=prod CONTROLLER=https://controller.example.com ./deploy.sh',
      '```',
      '',
      '### Using CLI Directly',
      '',
      'To deploy this external system:',
      '',
      '```bash',
      `aifabrix deploy ${appName}`,
      '```',
      '',
      '## Configuration',
      '',
      'Update the environment variables in `env.template` and set the values in your secrets store.',
      '',
      '## Documentation',
      '',
      'For more information, see the [External Systems Documentation](../../docs/external-systems.md).'
    ];

    await fs.writeFile(readmePath, lines.join('\n'), 'utf8');
    logger.log(chalk.green('✓ Generated README.md'));
  } catch (error) {
    throw new Error(`Failed to generate README.md: ${error.message}`);
  }
}

module.exports = {
  generateWizardFiles,
  generateDeployScripts
};

