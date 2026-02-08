/**
 * AI Fabrix Builder Deployment JSON Split Functions
 *
 * Helper functions for splitting deployment JSON files into component files
 *
 * @fileoverview Split functions for deployment JSON reverse conversion
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

/**
 * Converts configuration array back to env.template format
 * @function extractEnvTemplate
 * @param {Array} configuration - Configuration array from deployment JSON
 * @returns {string} env.template content
 */
function extractEnvTemplate(configuration) {
  if (!Array.isArray(configuration) || configuration.length === 0) {
    return '';
  }

  const lines = [];

  // Generate env.template lines
  for (const config of configuration) {
    if (!config.name || !config.value) {
      continue;
    }

    let value = config.value;
    // Add kv:// prefix if location is keyvault
    if (config.location === 'keyvault') {
      value = `kv://${value}`;
    }

    lines.push(`${config.name}=${value}`);
  }

  return lines.join('\n');
}

/**
 * Parses image reference string into components
 * @function parseImageReference
 * @param {string} imageString - Full image string (e.g., "registry/name:tag")
 * @returns {Object} Object with registry, name, and tag
 */
function parseImageReference(imageString) {
  if (!imageString || typeof imageString !== 'string') {
    return { registry: null, name: null, tag: 'latest' };
  }

  // Handle format: registry/name:tag or name:tag or registry/name
  const parts = imageString.split('/');
  let registry = null;
  let nameAndTag = imageString;

  if (parts.length > 1) {
    // Check if first part looks like a registry (contains .)
    if (parts[0].includes('.')) {
      registry = parts[0];
      nameAndTag = parts.slice(1).join('/');
    } else {
      // No registry, just name:tag
      nameAndTag = imageString;
    }
  }

  // Split name and tag
  const tagIndex = nameAndTag.lastIndexOf(':');
  let name = nameAndTag;
  let tag = 'latest';

  if (tagIndex !== -1) {
    name = nameAndTag.substring(0, tagIndex);
    tag = nameAndTag.substring(tagIndex + 1);
  }

  return { registry, name, tag };
}

/**
 * Extract app section from deployment
 * @param {Object} deployment - Deployment JSON object
 * @returns {Object|undefined} App section or undefined
 */
function extractAppSection(deployment) {
  if (!deployment.key && !deployment.displayName && !deployment.description && !deployment.type) {
    return undefined;
  }

  const app = {};
  if (deployment.key) app.key = deployment.key;
  if (deployment.displayName) app.displayName = deployment.displayName;
  if (deployment.description) app.description = deployment.description;
  if (deployment.type) app.type = deployment.type;
  if (deployment.version) app.version = deployment.version;
  return app;
}

/**
 * Extract image section from deployment
 * @param {Object} deployment - Deployment JSON object
 * @returns {Object|undefined} Image section or undefined
 */
function extractImageSection(deployment) {
  if (!deployment.image) {
    return undefined;
  }

  const imageParts = parseImageReference(deployment.image);
  const image = {};
  if (imageParts.name) image.name = imageParts.name;
  if (imageParts.registry) image.registry = imageParts.registry;
  if (imageParts.tag) image.tag = imageParts.tag;
  if (deployment.registryMode) image.registryMode = deployment.registryMode;
  return image;
}

/**
 * Extract requirements section from deployment
 * @param {Object} deployment - Deployment JSON object
 * @returns {Object|undefined} Requirements section or undefined
 */
function extractRequirementsSection(deployment) {
  if (!deployment.requiresDatabase && !deployment.requiresRedis && !deployment.requiresStorage && !deployment.databases) {
    return undefined;
  }

  const requires = {};
  if (deployment.requiresDatabase !== undefined) requires.database = deployment.requiresDatabase;
  if (deployment.requiresRedis !== undefined) requires.redis = deployment.requiresRedis;
  if (deployment.requiresStorage !== undefined) requires.storage = deployment.requiresStorage;
  if (deployment.databases) requires.databases = deployment.databases;
  return requires;
}

/**
 * Extract optional sections from deployment
 * @param {Object} deployment - Deployment JSON object
 * @returns {Object} Object with optional sections
 */
/**
 * Extracts a single optional section if present
 * @function extractOptionalSection
 * @param {Object} deployment - Deployment object
 * @param {string} sectionName - Section name to extract
 * @param {Object} optional - Optional sections object to update
 */
function extractOptionalSection(deployment, sectionName, optional) {
  if (deployment[sectionName]) {
    if (sectionName === 'authentication') {
      optional[sectionName] = { ...deployment[sectionName] };
    } else {
      optional[sectionName] = deployment[sectionName];
    }
  }
}

function extractOptionalSections(deployment) {
  const optional = {};

  const optionalSectionNames = [
    'healthCheck',
    'authentication',
    'build',
    'repository',
    'deployment',
    'startupCommand',
    'runtimeVersion',
    'scaling',
    'frontDoorRouting',
    'roles',
    'permissions'
  ];

  for (const sectionName of optionalSectionNames) {
    extractOptionalSection(deployment, sectionName, optional);
  }

  return optional;
}

/**
 * Extracts deployment JSON into variables.yaml structure
 * @function extractVariablesYaml
 * @param {Object} deployment - Deployment JSON object
 * @returns {Object} Variables YAML structure
 */
function extractVariablesYaml(deployment) {
  if (!deployment || typeof deployment !== 'object') {
    throw new Error('Deployment object is required');
  }

  const variables = {};

  // Extract app section
  const appSection = extractAppSection(deployment);
  if (appSection) {
    variables.app = appSection;
  }

  // Extract image section
  const imageSection = extractImageSection(deployment);
  if (imageSection) {
    variables.image = imageSection;
  }

  // Extract port
  if (deployment.port !== undefined) {
    variables.port = deployment.port;
  }

  // Extract requirements section
  const requirementsSection = extractRequirementsSection(deployment);
  if (requirementsSection) {
    variables.requires = requirementsSection;
  }

  // Extract optional sections
  const optionalSections = extractOptionalSections(deployment);
  Object.assign(variables, optionalSections);

  return variables;
}

/**
 * Extracts roles and permissions from deployment JSON
 * @function extractRbacYaml
 * @param {Object} deployment - Deployment JSON object
 * @returns {Object|null} RBAC YAML structure or null if no roles/permissions
 */
function extractRbacYaml(deployment) {
  if (!deployment || typeof deployment !== 'object') {
    return null;
  }

  const hasRoles = deployment.roles && Array.isArray(deployment.roles) && deployment.roles.length > 0;
  const hasPermissions = deployment.permissions && Array.isArray(deployment.permissions) && deployment.permissions.length > 0;

  if (!hasRoles && !hasPermissions) {
    return null;
  }

  const rbac = {};
  if (hasRoles) {
    rbac.roles = deployment.roles;
  }
  if (hasPermissions) {
    rbac.permissions = deployment.permissions;
  }

  return rbac;
}

/**
 * Generates README.md content from deployment JSON
 * @function generateReadmeFromDeployJson
 * @param {Object} deployment - Deployment JSON object
 * @returns {string} README.md content
 */
function generateReadmeFromDeployJson(deployment) {
  if (!deployment || typeof deployment !== 'object') {
    throw new Error('Deployment object is required');
  }

  const appName = deployment.key || 'application';
  const displayName = deployment.displayName || appName;
  const description = deployment.description || 'Application deployment configuration';
  const port = deployment.port || 3000;
  const image = deployment.image || 'unknown';

  const lines = [
    `# ${displayName}`,
    '',
    description,
    '',
    '## Quick Start',
    '',
    'This application is configured via deployment JSON and component files.',
    '',
    '## Configuration',
    '',
    `- **Application Key**: \`${appName}\``,
    `- **Port**: \`${port}\``,
    `- **Image**: \`${image}\``,
    '',
    '## Files',
    '',
    '- `variables.yaml` - Application configuration',
    '- `env.template` - Environment variables template',
    '- `rbac.yml` - Roles and permissions (if applicable)',
    '- `README.md` - This file',
    '',
    '## Documentation',
    '',
    'For more information, see the [AI Fabrix Builder documentation](../../docs/README.md).'
  ];

  return lines.join('\n');
}

/**
 * Splits a deployment JSON file into component files
 * @async
 * @function splitDeployJson
 * @param {string} deployJsonPath - Path to deployment JSON file
 * @param {string} [outputDir] - Directory to write component files (defaults to same directory as JSON)
 * @returns {Promise<Object>} Object with paths to generated files
 * @throws {Error} If JSON file not found or invalid
 */
/**
 * Validates deployment JSON path
 * @function validateDeployJsonPath
 * @param {string} deployJsonPath - Deployment JSON path
 * @throws {Error} If path is invalid
 */
function validateDeployJsonPath(deployJsonPath) {
  if (!deployJsonPath || typeof deployJsonPath !== 'string') {
    throw new Error('Deployment JSON path is required and must be a string');
  }
  const fsSync = require('fs');
  if (!fsSync.existsSync(deployJsonPath)) {
    throw new Error(`Deployment JSON file not found: ${deployJsonPath}`);
  }
}

/**
 * Prepares output directory
 * @async
 * @function prepareOutputDirectory
 * @param {string} deployJsonPath - Deployment JSON path
 * @param {string|null} outputDir - Optional output directory
 * @returns {Promise<string>} Final output directory path
 */
async function prepareOutputDirectory(deployJsonPath, outputDir) {
  const finalOutputDir = outputDir || path.dirname(deployJsonPath);
  const fsSync = require('fs');
  if (!fsSync.existsSync(finalOutputDir)) {
    await fs.mkdir(finalOutputDir, { recursive: true });
  }
  return finalOutputDir;
}

/**
 * Loads and parses deployment JSON
 * @async
 * @function loadDeploymentJson
 * @param {string} deployJsonPath - Deployment JSON path
 * @returns {Promise<Object>} Parsed deployment object
 */
async function loadDeploymentJson(deployJsonPath) {
  try {
    const jsonContent = await fs.readFile(deployJsonPath, 'utf8');
    return JSON.parse(jsonContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Deployment JSON file not found: ${deployJsonPath}`);
    }
    throw new Error(`Invalid JSON syntax in deployment file: ${error.message}`);
  }
}

/**
 * Writes a component file
 * @async
 * @function writeComponentFile
 * @param {string} filePath - File path
 * @param {string} content - File content
 * @returns {Promise<void>}
 */
async function writeComponentFile(filePath, content) {
  await fs.writeFile(filePath, content, { mode: 0o644, encoding: 'utf8' });
}

/**
 * Writes all component files
 * @async
 * @function writeComponentFiles
 * @param {string} outputDir - Output directory
 * @param {string} envTemplate - Environment template content
 * @param {Object} variables - Variables object
 * @param {Object|null} rbac - RBAC object or null
 * @param {string} readme - README content
 * @returns {Promise<Object>} Results object with file paths
 */
async function writeComponentFiles(outputDir, envTemplate, variables, rbac, readme) {
  const results = {};

  // Write env.template
  const envTemplatePath = path.join(outputDir, 'env.template');
  await writeComponentFile(envTemplatePath, envTemplate);
  results.envTemplate = envTemplatePath;

  // Write variables.yaml
  const variablesPath = path.join(outputDir, 'variables.yaml');
  const variablesYaml = yaml.dump(variables, { indent: 2, lineWidth: -1 });
  await writeComponentFile(variablesPath, variablesYaml);
  results.variables = variablesPath;

  // Write rbac.yml (only if roles/permissions exist)
  if (rbac) {
    const rbacPath = path.join(outputDir, 'rbac.yml');
    const rbacYaml = yaml.dump(rbac, { indent: 2, lineWidth: -1 });
    await writeComponentFile(rbacPath, rbacYaml);
    results.rbac = rbacPath;
  }

  // Write README.md
  const readmePath = path.join(outputDir, 'README.md');
  await writeComponentFile(readmePath, readme);
  results.readme = readmePath;

  return results;
}

async function splitDeployJson(deployJsonPath, outputDir = null) {
  validateDeployJsonPath(deployJsonPath);
  const finalOutputDir = await prepareOutputDirectory(deployJsonPath, outputDir);
  const deployment = await loadDeploymentJson(deployJsonPath);

  // Extract components
  const envTemplate = extractEnvTemplate(deployment.configuration || []);
  const variables = extractVariablesYaml(deployment);
  const rbac = extractRbacYaml(deployment);
  const readme = generateReadmeFromDeployJson(deployment);

  return await writeComponentFiles(finalOutputDir, envTemplate, variables, rbac, readme);
}

module.exports = {
  splitDeployJson,
  extractEnvTemplate,
  extractVariablesYaml,
  extractRbacYaml,
  parseImageReference,
  generateReadmeFromDeployJson
};

