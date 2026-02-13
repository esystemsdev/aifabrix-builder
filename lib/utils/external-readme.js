/**
 * External System README Generation
 *
 * Provides a shared Handlebars-based README generator for external systems.
 *
 * @fileoverview External system README generation utilities
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const { getProjectRoot } = require('./paths');

/**
 * Formats a display name from a key
 * @param {string} key - System or app key
 * @returns {string} Display name
 */
function formatDisplayName(key) {
  if (!key || typeof key !== 'string') {
    return 'External System';
  }
  return key
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalizes datasource entries for template use
 * @param {Array} datasources - Datasource objects
 * @param {string} systemKey - System key for filename generation
 * @returns {Array<{entityType: string, displayName: string, fileName: string}>} Normalized entries
 */
function normalizeDatasources(datasources, systemKey) {
  if (!Array.isArray(datasources)) {
    return [];
  }
  return datasources.map((datasource, index) => {
    const entityType = datasource.entityType ||
      datasource.entityKey ||
      datasource.key?.split('-').pop() ||
      `entity${index + 1}`;
    const displayName = datasource.displayName ||
      datasource.name ||
      `Datasource ${index + 1}`;
    let fileName = datasource.fileName || datasource.file;
    if (!fileName) {
      const key = datasource.key || '';
      // Suffix matches split getExternalDatasourceFileName for consistent README and file names
      let suffix;
      if (key.startsWith(`${systemKey}-deploy-`)) {
        suffix = key.slice(`${systemKey}-deploy-`.length);
      } else if (systemKey && key.startsWith(`${systemKey}-`)) {
        suffix = key.slice(systemKey.length + 1);
      } else if (key) {
        suffix = key;
      } else {
        suffix = entityType;
      }
      fileName = systemKey ? `${systemKey}-datasource-${suffix}.yaml` : `${suffix}.yaml`;
    }
    return { entityType, displayName, fileName };
  });
}

/**
 * Builds the external system README template context
 * @function buildExternalReadmeContext
 * @param {Object} params - Context parameters
 * @param {string} [params.appName] - Application name
 * @param {string} [params.systemKey] - System key
 * @param {string} [params.systemType] - System type
 * @param {string} [params.displayName] - Display name
 * @param {string} [params.description] - Description
 * @param {Array} [params.datasources] - Datasource objects
 * @returns {Object} Template context
 */
function buildExternalReadmeContext(params = {}) {
  const appName = params.appName || params.systemKey || 'external-system';
  const systemKey = params.systemKey || appName;
  const displayName = params.displayName || formatDisplayName(systemKey);
  const description = params.description || `External system integration for ${systemKey}`;
  const systemType = params.systemType || 'openapi';
  const datasources = normalizeDatasources(params.datasources, systemKey);

  return {
    appName,
    systemKey,
    displayName,
    description,
    systemType,
    datasourceCount: datasources.length,
    datasources
  };
}

/**
 * Loads and compiles the external system README template
 * @returns {Function} Compiled template
 * @throws {Error} If template is missing
 */
function loadExternalReadmeTemplate() {
  const projectRoot = getProjectRoot();
  const templatePath = path.join(projectRoot, 'templates', 'external-system', 'README.md.hbs');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`External system README template not found at ${templatePath}`);
  }
  const content = fs.readFileSync(templatePath, 'utf8');
  return handlebars.compile(content);
}

/**
 * Generates README content for an external system
 * @function generateExternalReadmeContent
 * @param {Object} params - Context parameters
 * @returns {string} README content
 */
function generateExternalReadmeContent(params = {}) {
  const template = loadExternalReadmeTemplate();
  const context = buildExternalReadmeContext(params);
  return template(context);
}

module.exports = {
  buildExternalReadmeContext,
  generateExternalReadmeContent
};
