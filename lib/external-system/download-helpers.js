/**
 * External System Download Helpers
 *
 * Helper functions for external system download file generation
 *
 * @fileoverview Download helper utilities for external system download
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const { generateExternalReadmeContent } = require('../utils/external-readme');

/**
 * Generates application.yaml content for downloaded system
 * @param {string} systemKey - System key
 * @param {Object} application - External system configuration
 * @param {Array} dataSources - Array of datasource configurations
 * @returns {Object} Variables YAML object
 */
function generateVariablesYaml(systemKey, application, dataSources) {
  const systemFileName = `${systemKey}-system.yaml`;
  const datasourceFiles = dataSources.map(ds => {
    // Extract datasource key (remove system key prefix if present)
    const datasourceKey = ds.key || '';
    let datasourceKeyOnly;
    if (datasourceKey.startsWith(`${systemKey}-`)) {
      datasourceKeyOnly = datasourceKey.substring(systemKey.length + 1);
    } else {
      const entityType = ds.entityType || ds.entityKey || datasourceKey.split('-').pop();
      datasourceKeyOnly = entityType;
    }
    return `${systemKey}-datasource-${datasourceKeyOnly}.yaml`;
  });

  return {
    app: {
      key: systemKey,
      displayName: application.displayName || systemKey,
      description: application.description || `External system integration for ${systemKey}`,
      type: 'external'
    },
    deployment: {
      controllerUrl: '',
      environment: 'dev'
    },
    externalIntegration: {
      schemaBasePath: './',
      systems: [systemFileName],
      dataSources: datasourceFiles,
      autopublish: false,
      version: application.version || '1.0.0'
    }
  };
}

/**
 * Generates README.md with setup instructions
 * @param {string} systemKey - System key
 * @param {Object} application - External system configuration
 * @param {Array} dataSources - Array of datasource configurations
 * @returns {string} README.md content
 */
function generateReadme(systemKey, application, dataSources) {
  const datasources = (Array.isArray(dataSources) ? dataSources : []).map((ds, index) => {
    const datasourceKey = ds.key || '';
    let datasourceKeyOnly;
    if (datasourceKey.startsWith(`${systemKey}-`)) {
      datasourceKeyOnly = datasourceKey.substring(systemKey.length + 1);
    } else {
      const entityType = ds.entityType || ds.entityKey || datasourceKey.split('-').pop() || `entity${index + 1}`;
      datasourceKeyOnly = entityType;
    }
    return {
      entityType: datasourceKeyOnly,
      displayName: ds.displayName || ds.name || ds.key || `Datasource ${index + 1}`,
      fileName: `${systemKey}-datasource-${datasourceKeyOnly}.yaml`
    };
  });

  return generateExternalReadmeContent({
    appName: systemKey,
    systemKey,
    systemType: application.type,
    displayName: application.displayName,
    description: application.description,
    datasources
  });
}

module.exports = {
  generateVariablesYaml,
  generateReadme
};

