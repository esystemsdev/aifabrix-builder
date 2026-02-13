/**
 * README generation from deployment JSON for split flow.
 * @fileoverview Builds readme config and generates README from deployment JSON
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { generateReadmeMd } = require('../app/readme');
const { parseImageReference } = require('./parse-image');

/**
 * Builds config for external-system README from deployment
 * @param {Object} deployment - Deployment JSON object
 * @returns {{ appName: string, config: Object }}
 */
function buildReadmeConfigForExternal(deployment) {
  const system = deployment.system;
  const appName = system.key || deployment.key || 'external-system';
  const dataSources = deployment.dataSources || deployment.datasources || [];
  return {
    appName,
    config: {
      type: 'external',
      systemKey: appName,
      systemType: system.type || 'openapi',
      systemDisplayName: system.displayName || appName,
      systemDescription: system.description || `External system integration for ${appName}`,
      datasourceCount: dataSources.length,
      datasources: dataSources
    }
  };
}

/**
 * Builds config for application README from deployment
 * @param {Object} deployment - Deployment JSON object
 * @returns {{ appName: string, config: Object }}
 */
function buildReadmeConfigForApp(deployment) {
  const appName = deployment.key || 'application';
  const imageParts = parseImageReference(deployment.image || '');
  const port = deployment.port !== undefined ? deployment.port : 3000;
  const imageName = imageParts.name || appName;
  const registry = imageParts.registry || 'myacr.azurecr.io';

  const config = {
    type: deployment.type || 'webapp',
    displayName: deployment.displayName,
    description: deployment.description,
    port,
    build: { localPort: port },
    image: { name: imageName, registry },
    registry,
    database: deployment.requiresDatabase,
    requires: {
      database: deployment.requiresDatabase,
      redis: deployment.requiresRedis,
      storage: deployment.requiresStorage
    },
    redis: deployment.requiresRedis,
    storage: deployment.requiresStorage,
    authentication: !!deployment.authentication
  };

  if (config.type === 'external') {
    config.systemKey = appName;
    config.systemType = deployment.systemType || 'openapi';
    config.systemDisplayName = deployment.displayName || appName;
    config.systemDescription = deployment.description || `External system integration for ${appName}`;
    config.datasourceCount = 0;
    config.datasources = deployment.dataSources || deployment.datasources || [];
  }

  return { appName, config };
}

/**
 * Builds application config shape from deployment JSON for README template context.
 * @param {Object} deployment - Deployment JSON object
 * @returns {{ appName: string, config: Object }}
 */
function buildReadmeConfigFromDeployment(deployment) {
  if (deployment.system && typeof deployment.system === 'object') {
    return buildReadmeConfigForExternal(deployment);
  }
  return buildReadmeConfigForApp(deployment);
}

/**
 * Generates README.md content from deployment JSON.
 * @param {Object} deployment - Deployment JSON object
 * @returns {string} README.md content
 */
function generateReadmeFromDeployJson(deployment) {
  if (!deployment || typeof deployment !== 'object') {
    throw new Error('Deployment object is required');
  }
  const { appName, config } = buildReadmeConfigFromDeployment(deployment);
  return generateReadmeMd(appName, config);
}

module.exports = {
  buildReadmeConfigFromDeployment,
  generateReadmeFromDeployJson
};
