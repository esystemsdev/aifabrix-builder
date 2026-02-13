/**
 * Convert command: convert integration/external system and datasource config files between JSON and YAML.
 *
 * Process: validate first, then (unless --force) prompt for confirmation, then convert (write new files),
 * update application config links, then delete old files.
 *
 * @fileoverview Convert config format (JSON/YAML) for external integration files
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { detectAppType } = require('../utils/paths');
const { logOfflinePathWhenType } = require('../utils/cli-utils');
const { resolveApplicationConfigPath } = require('../utils/app-config-resolver');
const { loadConfigFile, writeConfigFile } = require('../utils/config-format');

const TARGET_EXT = { yaml: '.yaml', json: '.json' };
const APP_CONFIG_NAMES = { yaml: 'application.yaml', json: 'application.json' };

/**
 * Prompts the user for confirmation (y/N).
 *
 * @param {string} message - Prompt message
 * @returns {Promise<boolean>} True if user confirms (y/yes), false otherwise
 */
function promptConfirm(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(message, answer => {
      rl.close();
      const normalized = (answer || '').trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes');
    });
  });
}

/**
 * Returns the target filename for a given file path and format (same base name, new extension).
 *
 * @param {string} filePath - Current file path
 * @param {string} format - Target format: 'json' or 'yaml'
 * @returns {string} New filename (basename only)
 */
function targetFileName(filePath, format) {
  const base = path.basename(filePath, path.extname(filePath));
  const ext = TARGET_EXT[format] || (format === 'json' ? '.json' : '.yaml');
  return base + ext;
}

/**
 * Converts a single config file to the target format: writes to new path, returns old and new paths.
 *
 * @param {string} sourcePath - Absolute path to existing file
 * @param {string} targetPath - Absolute path for new file
 * @param {string} format - 'json' or 'yaml'
 * @returns {{ oldPath: string, newPath: string }}
 */
function convertOneFile(sourcePath, targetPath, format) {
  const obj = loadConfigFile(sourcePath);
  writeConfigFile(targetPath, obj, format);
  return { oldPath: sourcePath, newPath: targetPath };
}

/**
 * Converts a list of config files (system or datasource) in a directory; skips missing files.
 *
 * @param {string} schemaBasePath - Base directory for files
 * @param {string[]} fileNames - List of filenames
 * @param {string} format - 'json' or 'yaml'
 * @returns {{ converted: string[], toDelete: string[], newNames: string[] }}
 */
function convertFileList(schemaBasePath, fileNames, format) {
  const converted = [];
  const toDelete = [];
  const newNames = [];
  for (const fileName of fileNames) {
    const sourcePath = path.join(schemaBasePath, fileName);
    if (!fs.existsSync(sourcePath)) {
      newNames.push(fileName);
      continue;
    }
    const newFileName = targetFileName(sourcePath, format);
    const targetPath = path.join(schemaBasePath, newFileName);
    convertOneFile(sourcePath, targetPath, format);
    converted.push(targetPath);
    newNames.push(newFileName);
    if (path.normalize(sourcePath) !== path.normalize(targetPath)) {
      toDelete.push(sourcePath);
    }
  }
  return { converted, toDelete, newNames };
}

/**
 * Validates app and prompts for confirmation unless opts.force.
 *
 * @param {Object} opts - Options
 * @param {string} opts.appName - Application name
 * @param {Object} opts.cmdOptions - Command options (force, type)
 * @param {string} opts.schemaBasePath - Base path for external files
 * @param {string[]} opts.systemFiles - System file names
 * @param {string[]} opts.datasourceFiles - Datasource file names
 * @param {string} opts.configPath - Current application config path
 * @param {string} opts.format - Target format
 * @throws {Error} If validation fails or user cancels
 */
async function validateAndPrompt(opts) {
  const validate = require('../validation/validate');
  const result = await validate.validateAppOrFile(opts.appName, opts.cmdOptions);
  if (!result.valid) {
    validate.displayValidationResults(result);
    throw new Error('Validation failed. Fix errors before converting.');
  }
  const { configPath, format, schemaBasePath, systemFiles, datasourceFiles } = opts;
  const appConfigName = APP_CONFIG_NAMES[format];
  const targetConfigPath = path.join(path.dirname(configPath), appConfigName);
  const willConvertAppConfig = path.normalize(configPath) !== path.normalize(targetConfigPath) ||
    path.extname(configPath) !== (format === 'json' ? '.json' : '.yaml');
  const summaryLines = [...systemFiles, ...datasourceFiles]
    .filter(Boolean)
    .map(f => `  • ${f} → ${targetFileName(path.join(schemaBasePath, f), format)}`);
  if (willConvertAppConfig) summaryLines.push(`  • application config → ${appConfigName}`);
  summaryLines.push('  Old files will be removed after writing new ones.');
  if (!opts.cmdOptions.force) {
    const confirmed = await promptConfirm(`Convert the following to ${format}?\n${summaryLines.join('\n')}\nAre you sure? (y/N) `);
    if (!confirmed) throw new Error('Convert cancelled.');
  }
}

/**
 * Converts files, updates application config, and deletes old files.
 *
 * @param {Object} variables - Current application config
 * @param {string} configPath - Current application config path
 * @param {string} schemaBasePath - Base path for external files
 * @param {string[]} systemFiles - System file names
 * @param {string[]} datasourceFiles - Datasource file names
 * @param {string} format - Target format
 * @returns {{ converted: string[], deleted: string[] }}
 */
function executeConversion(variables, configPath, schemaBasePath, systemFiles, datasourceFiles, format) {
  const sys = convertFileList(schemaBasePath, systemFiles, format);
  const ds = convertFileList(schemaBasePath, datasourceFiles, format);
  const converted = [...sys.converted, ...ds.converted];
  const toDelete = [...sys.toDelete, ...ds.toDelete];
  const updatedVariables = { ...variables };
  if (updatedVariables.externalIntegration) {
    updatedVariables.externalIntegration = { ...updatedVariables.externalIntegration };
    updatedVariables.externalIntegration.systems = sys.newNames;
    updatedVariables.externalIntegration.dataSources = ds.newNames;
  }
  const appConfigName = APP_CONFIG_NAMES[format];
  const targetConfigPath = path.join(path.dirname(configPath), appConfigName);
  writeConfigFile(targetConfigPath, updatedVariables, format);
  converted.push(targetConfigPath);
  if (path.normalize(configPath) !== path.normalize(targetConfigPath)) toDelete.push(configPath);
  toDelete.forEach(oldPath => {
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  });
  return { converted, deleted: toDelete };
}

/**
 * Runs conversion: validate first, optional prompt, convert files, update app config links, delete old files.
 *
 * @param {string} appName - Application name
 * @param {Object} options - Command options
 * @param {string} options.format - Target format: 'json' or 'yaml'
 * @param {boolean} [options.force] - Skip confirmation prompt
 *
 * @returns {Promise<{ converted: string[], deleted: string[] }>} Lists of converted and deleted file paths
 * @throws {Error} If validation fails, user aborts, or conversion fails
 */
async function runConvert(appName, options) {
  const format = (options.format || '').toLowerCase();
  if (format !== 'json' && format !== 'yaml') {
    throw new Error('Option --format is required and must be \'json\' or \'yaml\'');
  }
  const { appPath } = await detectAppType(appName);
  logOfflinePathWhenType(appPath);
  const configPath = resolveApplicationConfigPath(appPath);
  const variables = loadConfigFile(configPath);
  const schemaBasePath = path.resolve(path.dirname(configPath), variables.externalIntegration?.schemaBasePath || './');
  const systemFiles = variables.externalIntegration?.systems || [];
  const datasourceFiles = variables.externalIntegration?.dataSources || [];
  await validateAndPrompt({
    appName, cmdOptions: options, schemaBasePath, systemFiles, datasourceFiles, configPath, format
  });
  return executeConversion(variables, configPath, schemaBasePath, systemFiles, datasourceFiles, format);
}

module.exports = {
  runConvert,
  promptConfirm,
  targetFileName,
  convertOneFile
};
