/**
 * Config Format Converter Layer
 *
 * Single place for YAML/JSON config I/O. All config loaders and writers use this
 * layer; internal code works with plain JS objects and JSON Schema only.
 *
 * @fileoverview Config format conversion (YAML/JSON) at I/O boundary
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const YAML_EXTENSIONS = ['.yaml', '.yml'];
const JSON_EXTENSIONS = ['.json'];

const DEFAULT_YAML_OPTIONS = { indent: 2, lineWidth: 120, noRefs: true };

/**
 * Parses YAML string to plain JS object (same shape as JSON).
 * Used when reading .yaml / .yml files.
 *
 * @param {string} content - YAML string content
 * @returns {Object} Plain JS object
 * @throws {Error} If YAML syntax is invalid
 */
function yamlToJson(content) {
  if (typeof content !== 'string') {
    throw new Error('yamlToJson expects a string');
  }
  try {
    const parsed = yaml.load(content);
    return parsed === undefined || parsed === null ? {} : parsed;
  } catch (error) {
    throw new Error(`Invalid YAML syntax: ${error.message}`);
  }
}

/**
 * Serializes JS object to YAML string.
 * Used when writing human-editable config as YAML.
 *
 * @param {Object} object - Plain JS object (config)
 * @param {Object} [options] - js-yaml dump options
 * @returns {string} YAML string
 */
function jsonToYaml(object, options = {}) {
  if (object === undefined || object === null) {
    return '';
  }
  const opts = { ...DEFAULT_YAML_OPTIONS, ...options };
  return yaml.dump(object, opts);
}

/**
 * Returns whether the file path is treated as YAML by extension.
 *
 * @param {string} filePath - File path
 * @returns {boolean} True if .yaml or .yml
 */
function isYamlPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return YAML_EXTENSIONS.includes(ext);
}

/**
 * Returns whether the file path is treated as JSON by extension.
 *
 * @param {string} filePath - File path
 * @returns {boolean} True if .json
 */
function isJsonPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return JSON_EXTENSIONS.includes(ext);
}

/**
 * Reads config file at path; by extension uses yamlToJson or JSON.parse.
 * Single entry point for "read config file regardless of format".
 *
 * @param {string} filePath - Absolute path to config file
 * @returns {Object} Parsed config object
 * @throws {Error} If file not found, unreadable, or invalid format
 */
function loadConfigFile(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('loadConfigFile requires a non-empty file path');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  if (YAML_EXTENSIONS.includes(ext)) {
    return yamlToJson(content);
  }
  if (JSON_EXTENSIONS.includes(ext)) {
    try {
      const parsed = JSON.parse(content);
      return parsed === undefined || parsed === null ? {} : parsed;
    } catch (error) {
      throw new Error(`Invalid JSON syntax in ${path.basename(filePath)}: ${error.message}`);
    }
  }
  throw new Error(`Unsupported config file extension: ${ext}. Use .yaml, .yml, or .json`);
}

/**
 * Writes config object to path as YAML or JSON based on format or path extension.
 *
 * @param {string} filePath - Absolute path to write (extension determines format if format omitted)
 * @param {Object} object - Config object to write
 * @param {string} [format] - 'yaml' or 'json'; if omitted, inferred from filePath extension
 * @throws {Error} If format is invalid or write fails
 */
function writeConfigFile(filePath, object, format) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('writeConfigFile requires a non-empty file path');
  }
  let targetFormat = format;
  if (!targetFormat) {
    const ext = path.extname(filePath).toLowerCase();
    if (YAML_EXTENSIONS.includes(ext)) {
      targetFormat = 'yaml';
    } else if (JSON_EXTENSIONS.includes(ext)) {
      targetFormat = 'json';
    } else {
      throw new Error(`Cannot infer format from path ${filePath}. Use .yaml, .yml, or .json, or pass format.`);
    }
  }
  const normalized = targetFormat.toLowerCase();
  let content;
  if (normalized === 'yaml' || normalized === 'yml') {
    content = jsonToYaml(object);
  } else if (normalized === 'json') {
    content = JSON.stringify(object, null, 2);
  } else {
    throw new Error(`Invalid format: ${format}. Use 'yaml' or 'json'.`);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

module.exports = {
  yamlToJson,
  jsonToYaml,
  loadConfigFile,
  writeConfigFile,
  isYamlPath,
  isJsonPath
};
