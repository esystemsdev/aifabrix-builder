/**
 * Wizard README generation - used by wizard file generator
 * @fileoverview Generates README.md for external system wizard output
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const logger = require('../utils/logger');
const { generateExternalReadmeContent } = require('../utils/external-readme');

const FORMAT_EXT = { yaml: '.yaml', json: '.json' };

/**
 * Converts a string to a schema-valid key segment (lowercase letters, numbers, hyphens only).
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
 * Generate README.md with basic documentation
 * @async
 * @function generateReadme
 * @param {Object} options - Options for README generation
 * @param {string} options.appPath - Application directory path
 * @param {string} options.appName - Application name
 * @param {string} options.systemKey - System key
 * @param {Object} options.systemConfig - System configuration
 * @param {Object[]} options.datasourceConfigs - Array of datasource configurations
 * @param {string} [options.aiGeneratedContent] - Optional AI-generated README content from dataplane
 * @param {string} [options.format] - Output format: 'yaml' or 'json'
 * @throws {Error} If generation fails
 */
async function generateReadme(options) {
  const { appPath, appName, systemKey, systemConfig, datasourceConfigs, aiGeneratedContent, format } = options;
  try {
    const readmePath = path.join(appPath, 'README.md');

    if (aiGeneratedContent) {
      await fs.writeFile(readmePath, aiGeneratedContent, 'utf8');
      logger.log(chalk.green('✓ Generated README.md (AI-generated from dataplane)'));
      return;
    }

    const ext = FORMAT_EXT[format === 'json' ? 'json' : 'yaml'] || '.yaml';
    const datasources = (Array.isArray(datasourceConfigs) ? datasourceConfigs : []).map((ds, index) => {
      const entityType = ds.entityType || ds.entityKey || ds.key?.split('-').pop() || `datasource${index + 1}`;
      const keySegment = toKeySegment(entityType);
      const datasourceKey = ds.key || `${systemKey}-${keySegment}`;
      const datasourceKeyOnly = datasourceKey.includes('-') && datasourceKey.startsWith(`${systemKey}-`)
        ? datasourceKey.substring(systemKey.length + 1)
        : keySegment;
      return {
        key: datasourceKey,
        entityType,
        displayName: ds.displayName || ds.name || ds.key || `Datasource ${index + 1}`,
        fileName: `${systemKey}-datasource-${datasourceKeyOnly}${ext}`
      };
    });

    const readmeContent = generateExternalReadmeContent({
      appName,
      systemKey,
      systemType: systemConfig.type || systemConfig.systemType,
      displayName: systemConfig.displayName,
      description: systemConfig.description,
      fileExt: ext,
      datasources
    });

    await fs.writeFile(readmePath, readmeContent, 'utf8');
    logger.log(chalk.green('✓ Generated README.md (template)'));
  } catch (error) {
    throw new Error(`Failed to generate README.md: ${error.message}`);
  }
}

module.exports = { generateReadme };
