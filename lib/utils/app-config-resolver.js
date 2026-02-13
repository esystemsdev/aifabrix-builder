/**
 * Application config path resolution
 *
 * Single entry point for resolving path to application config file
 * (application.yaml, application.json, or legacy variables.yaml).
 *
 * @fileoverview Resolve application config file path with legacy migration
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Resolves path to application config file (application.yaml, application.json, or legacy variables.yaml).
 * If only variables.yaml exists, renames it to application.yaml and returns the new path.
 *
 * @param {string} appPath - Absolute path to application directory
 * @returns {string} Absolute path to application config file
 * @throws {Error} If no config file found
 */
function resolveApplicationConfigPath(appPath) {
  if (!appPath || typeof appPath !== 'string') {
    throw new Error('App path is required and must be a string');
  }
  const applicationYaml = path.join(appPath, 'application.yaml');
  const applicationYml = path.join(appPath, 'application.yml');
  const applicationJson = path.join(appPath, 'application.json');
  const variablesYaml = path.join(appPath, 'variables.yaml');

  if (fs.existsSync(applicationYaml)) {
    return applicationYaml;
  }
  if (fs.existsSync(applicationYml)) {
    return applicationYml;
  }
  if (fs.existsSync(applicationJson)) {
    return applicationJson;
  }
  if (fs.existsSync(variablesYaml)) {
    fs.renameSync(variablesYaml, applicationYaml);
    return applicationYaml;
  }
  throw new Error(
    `Application config not found in ${appPath}. Expected application.yaml, application.yml, application.json, or variables.yaml.`
  );
}

module.exports = { resolveApplicationConfigPath };
