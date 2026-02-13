/**
 * External Schema Split Utilities
 *
 * Helpers for splitting application-schema.json into component files.
 *
 * @fileoverview External schema split utilities for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { generateEnvTemplate } = require('../utils/external-system-env-helpers');
const { extractRbacYaml } = require('./split');
const { generateExternalReadmeContent } = require('../utils/external-readme');

/**
 * Parses application-schema.json content
 * @function parseApplicationSchema
 * @param {string} schemaPath - Schema file path
 * @param {string} content - Raw JSON content
 * @returns {Object} Parsed schema details
 * @throws {Error} If JSON or schema structure is invalid
 */
function parseApplicationSchema(schemaPath, content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON syntax in ${schemaPath}: ${error.message}`);
  }

  const application = parsed.application;
  const dataSources = Array.isArray(parsed.dataSources) ? parsed.dataSources : [];
  if (!application || typeof application !== 'object') {
    throw new Error('application-schema.json must include an "application" object');
  }

  return { application, dataSources, version: parsed.version };
}

/**
 * Extracts system key from application schema
 * @function getSystemKey
 * @param {Object} application - Application schema object
 * @returns {string} System key
 * @throws {Error} If system key is missing
 */
function getSystemKey(application) {
  const systemKey = application.key;
  if (!systemKey || typeof systemKey !== 'string') {
    throw new Error('application.key is required to split external system files');
  }
  return systemKey;
}

/**
 * Resolves datasource entity type
 * @function getDatasourceEntityType
 * @param {Object} datasource - Datasource schema
 * @param {number} index - Datasource index
 * @returns {string} Entity type
 */
function getDatasourceEntityType(datasource, index) {
  return (
    datasource.entityType ||
    datasource.entityKey ||
    datasource.key?.split('-').pop() ||
    `entity${index + 1}`
  );
}

/**
 * Builds datasource file name
 * @function getDatasourceFileName
 * @param {string} systemKey - System key
 * @param {Object} datasource - Datasource schema
 * @param {number} index - Datasource index
 * @returns {string} Datasource file name
 */
function getDatasourceFileName(systemKey, datasource, index) {
  const datasourceKey = datasource.key || '';
  // Extract datasource key (remove system key prefix if present)
  let datasourceKeyOnly;
  if (datasourceKey.startsWith(`${systemKey}-`)) {
    datasourceKeyOnly = datasourceKey.substring(systemKey.length + 1);
  } else if (datasourceKey.startsWith(`${systemKey}-deploy-`)) {
    // Support old naming format during migration
    datasourceKeyOnly = datasourceKey.substring(`${systemKey}-deploy-`.length);
  } else {
    datasourceKeyOnly = getDatasourceEntityType(datasource, index);
  }
  return `${systemKey}-datasource-${datasourceKeyOnly}.yaml`;
}

/**
 * Writes datasource files and returns file names
 * @async
 * @function writeDatasourceFiles
 * @param {string} outputDir - Output directory
 * @param {string} systemKey - System key
 * @param {Object[]} dataSources - Datasource schemas
 * @returns {Promise<string[]>} Datasource file names
 */
async function writeDatasourceFiles(outputDir, systemKey, dataSources) {
  const datasourceFileNames = [];
  for (let i = 0; i < dataSources.length; i += 1) {
    const datasource = dataSources[i];
    const datasourceFileName = getDatasourceFileName(systemKey, datasource, i);
    const datasourceFilePath = path.join(outputDir, datasourceFileName);
    await writeYamlFile(datasourceFilePath, datasource, { indent: 2, lineWidth: 120, noRefs: true });
    datasourceFileNames.push(datasourceFileName);
  }
  return datasourceFileNames;
}

/**
 * Builds application config content for external integrations
 * @function buildExternalVariables
 * @param {string} systemKey - System key
 * @param {Object} application - Application schema
 * @param {string} systemFileName - System file name
 * @param {string[]} datasourceFileNames - Datasource file names
 * @param {string} version - Schema version
 * @returns {Object} Variables content
 */
function buildExternalVariables(systemKey, application, systemFileName, datasourceFileNames, version) {
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
      dataSources: datasourceFileNames,
      autopublish: true,
      version
    }
  };
}

/**
 * Writes YAML file
 * @async
 * @function writeYamlFile
 * @param {string} filePath - File path
 * @param {Object} data - YAML data
 * @param {Object} options - YAML options
 * @returns {Promise<void>} Resolves when file is written
 */
async function writeYamlFile(filePath, data, options) {
  const yamlContent = yaml.dump(data, options);
  await fs.promises.writeFile(filePath, yamlContent, 'utf8');
}

/**
 * Writes split files for external application schemas
 * @async
 * @function writeSplitExternalSchemaFiles
 * @param {Object} params - Split parameters
 * @param {string} params.outputDir - Output directory
 * @param {string} params.systemKey - System key
 * @param {Object} params.application - Application schema
 * @param {Object[]} params.dataSources - Datasource schemas
 * @param {string} params.version - Schema version
 * @returns {Promise<Object>} Paths to generated files
 */
async function writeSplitExternalSchemaFiles({ outputDir, systemKey, application, dataSources, version }) {
  const systemFileName = `${systemKey}-system.yaml`;
  const systemFilePath = path.join(outputDir, systemFileName);
  await writeYamlFile(systemFilePath, application, { indent: 2, lineWidth: 120, noRefs: true });

  const datasourceFileNames = await writeDatasourceFiles(outputDir, systemKey, dataSources);
  const variables = buildExternalVariables(systemKey, application, systemFileName, datasourceFileNames, version);

  const variablesPath = path.join(outputDir, 'application.yaml');
  await writeYamlFile(variablesPath, variables, { indent: 2, lineWidth: 120, noRefs: true });

  const envTemplatePath = path.join(outputDir, 'env.template');
  const envTemplate = generateEnvTemplate(application);
  await fs.promises.writeFile(envTemplatePath, envTemplate, 'utf8');

  const rbac = extractRbacYaml(application);
  let rbacPath = null;
  if (rbac) {
    rbacPath = path.join(outputDir, 'rbac.yml');
    await writeYamlFile(rbacPath, rbac, { indent: 2, lineWidth: -1 });
  }

  const readmeContent = generateExternalReadmeContent({
    appName: systemKey,
    systemKey,
    systemType: application.type,
    displayName: application.displayName,
    description: application.description,
    datasources: dataSources
  });
  const readmePath = path.join(outputDir, 'README.md');
  await fs.promises.writeFile(readmePath, readmeContent, 'utf8');

  return {
    systemFile: systemFilePath,
    datasourceFiles: datasourceFileNames.map(name => path.join(outputDir, name)),
    variables: variablesPath,
    envTemplate: envTemplatePath,
    rbac: rbacPath,
    readme: readmePath
  };
}

module.exports = {
  parseApplicationSchema,
  getSystemKey,
  writeSplitExternalSchemaFiles
};
