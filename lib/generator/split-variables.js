/**
 * Variables YAML extraction for deployment JSON split.
 * Extracts application.yaml (variables) structure from deployment JSON.
 *
 * @fileoverview Split variables extraction for deployment JSON reverse conversion
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { parseImageReference } = require('./parse-image');

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

function extractImageSection(deployment) {
  if (!deployment.image) return undefined;
  const imageParts = parseImageReference(deployment.image);
  const image = {};
  if (imageParts.name) image.name = imageParts.name;
  if (imageParts.registry) image.registry = imageParts.registry;
  if (imageParts.tag) image.tag = imageParts.tag;
  if (deployment.registryMode) image.registryMode = deployment.registryMode;
  return image;
}

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

function extractOptionalSection(deployment, sectionName, optional) {
  if (!deployment[sectionName]) return;
  optional[sectionName] = sectionName === 'authentication'
    ? { ...deployment[sectionName] }
    : deployment[sectionName];
}

function extractOptionalSections(deployment) {
  const optional = {};
  const names = [
    'healthCheck', 'authentication', 'build', 'repository', 'deployment',
    'startupCommand', 'runtimeVersion', 'scaling', 'frontDoorRouting'
  ];
  for (const sectionName of names) {
    extractOptionalSection(deployment, sectionName, optional);
  }
  return optional;
}

/**
 * Portal-only configuration for application.yaml (name + portalInput per entry).
 * @param {Array} configuration - Configuration array from deployment JSON
 * @returns {Array<{ name: string, portalInput: Object }>}
 */
function extractPortalInputConfiguration(configuration) {
  if (!Array.isArray(configuration) || configuration.length === 0) return [];
  return configuration
    .filter(item => item && item.portalInput && typeof item.name === 'string')
    .map(item => ({ name: item.name, portalInput: item.portalInput }));
}

/**
 * Datasource filename for externalIntegration.dataSources.
 * @param {string} systemKey - System key
 * @param {Object} datasource - Datasource from deployment.dataSources
 * @param {number} index - Index
 * @returns {string} Filename e.g. test-hubspot-datasource-companies-data.yaml
 */
function getExternalDatasourceFileName(systemKey, datasource, index) {
  const key = datasource.key || '';
  let suffix;
  if (key.startsWith(`${systemKey}-deploy-`)) suffix = key.slice(`${systemKey}-deploy-`.length);
  else if (key.startsWith(`${systemKey}-`)) suffix = key.slice(systemKey.length + 1);
  else if (key) suffix = key;
  else suffix = datasource.entityType || datasource.entityKey || `entity${index + 1}`;
  return `${systemKey}-datasource-${suffix}.yaml`;
}

function extractVariablesYamlForExternal(deployment) {
  const system = deployment.system;
  const systemKey = system.key || 'external-system';
  const dataSourcesList = deployment.dataSources || deployment.datasources || [];
  const variables = {
    app: {
      key: systemKey,
      displayName: system.displayName || systemKey,
      description: system.description || `External system integration for ${systemKey}`,
      type: 'external'
    },
    externalIntegration: {
      schemaBasePath: './',
      systems: [`${systemKey}-system.yaml`],
      dataSources: dataSourcesList.map((ds, i) => getExternalDatasourceFileName(systemKey, ds, i)),
      autopublish: true,
      version: '1.0.0'
    }
  };
  const portalOnlyConfig = extractPortalInputConfiguration(deployment.configuration);
  if (portalOnlyConfig.length > 0) variables.configuration = portalOnlyConfig;
  return variables;
}

/**
 * Extracts deployment JSON into application config (variables) structure.
 * @param {Object} deployment - Deployment JSON object
 * @returns {Object} Variables YAML structure
 */
function extractVariablesYaml(deployment) {
  if (!deployment || typeof deployment !== 'object') {
    throw new Error('Deployment object is required');
  }
  if (deployment.system && typeof deployment.system === 'object') {
    return extractVariablesYamlForExternal(deployment);
  }
  const variables = {};
  const appSection = extractAppSection(deployment);
  if (appSection) variables.app = appSection;
  const imageSection = extractImageSection(deployment);
  if (imageSection) variables.image = imageSection;
  if (deployment.port !== undefined) variables.port = deployment.port;
  const requirementsSection = extractRequirementsSection(deployment);
  if (requirementsSection) variables.requires = requirementsSection;
  Object.assign(variables, extractOptionalSections(deployment));
  const portalOnlyConfig = extractPortalInputConfiguration(deployment.configuration);
  if (portalOnlyConfig.length > 0) variables.configuration = portalOnlyConfig;
  return variables;
}

module.exports = {
  extractVariablesYaml,
  getExternalDatasourceFileName
};
