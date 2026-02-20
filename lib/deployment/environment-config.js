/**
 * Environment deployment config and preset helpers.
 * Parses/validates JSON config and builds preset-based config.
 *
 * @fileoverview Environment config for AI Fabrix Builder
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const { formatValidationErrors } = require('../utils/error-formatter');
const environmentDeployRequestSchema = require('../schema/environment-deploy-request.schema.json');

/** Allowed preset values for --preset (case-insensitive); API expects lowercase s, m, l, xl */
const PRESET_VALUES = ['s', 'm', 'l', 'xl'];
const DEFAULT_PRESET = 's';
const DEFAULT_SERVICE_NAME = 'aifabrix';
const DEFAULT_LOCATION = 'swedencentral';

/**
 * Normalizes and validates preset from CLI (s, m, l, xl; case-insensitive)
 * @param {string} [preset] - User-provided preset
 * @returns {string} Normalized preset (lowercase)
 * @throws {Error} If preset is not one of s, m, l, xl
 */
function normalizePreset(preset) {
  const raw = (preset === null || preset === undefined || preset === '') ? DEFAULT_PRESET : String(preset).trim().toLowerCase();
  if (!PRESET_VALUES.includes(raw)) {
    throw new Error(
      `Invalid preset "${preset}". Use one of: ${PRESET_VALUES.join(', ')}.\n` +
      'Example: aifabrix env deploy dev --preset s'
    );
  }
  return raw;
}

/**
 * Builds environmentConfig from env key and preset (no config file)
 * @param {string} validatedEnvKey - Validated environment key
 * @param {string} preset - Normalized preset (s, m, l, xl)
 * @returns {Object} { environmentConfig, dryRun: false }
 */
function buildEnvironmentConfigFromPreset(validatedEnvKey, preset) {
  return {
    environmentConfig: {
      key: validatedEnvKey,
      environment: validatedEnvKey,
      preset,
      serviceName: DEFAULT_SERVICE_NAME,
      location: DEFAULT_LOCATION
    },
    dryRun: false
  };
}

/** Reads and parses config file; throws if missing, unreadable, or invalid structure. */
function parseEnvironmentConfigFile(resolvedPath) {
  let raw;
  try {
    raw = fs.readFileSync(resolvedPath, 'utf8');
  } catch (e) {
    throw new Error(`Cannot read config file: ${resolvedPath}. ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Invalid JSON in config file: ${resolvedPath}\n${e.message}\n` +
      'Expected format: { "environmentConfig": { "key", "environment", "preset", "serviceName", "location" }, "dryRun": false }'
    );
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(
      `Config file must be a JSON object with "environmentConfig". File: ${resolvedPath}\n` +
      'Example: { "environmentConfig": { "key": "dev", "environment": "dev", "preset": "s", "serviceName": "aifabrix", "location": "swedencentral" }, "dryRun": false }'
    );
  }
  if (parsed.environmentConfig === undefined) {
    throw new Error(
      `Config file must contain "environmentConfig" (object). File: ${resolvedPath}\n` +
      'Example: { "environmentConfig": { "key": "dev", "environment": "dev", "preset": "s", "serviceName": "aifabrix", "location": "swedencentral" } }'
    );
  }
  if (typeof parsed.environmentConfig !== 'object' || parsed.environmentConfig === null) {
    throw new Error(`"environmentConfig" must be an object. File: ${resolvedPath}`);
  }
  return parsed;
}

/**
 * Validates parsed config against schema and returns deploy request.
 * @param {Object} parsed - Parsed config object
 * @param {string} resolvedPath - Path for error messages
 * @returns {Object} { environmentConfig, dryRun? }
 */
function validateEnvironmentDeployParsed(parsed, resolvedPath) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(environmentDeployRequestSchema);
  if (!validate(parsed)) {
    const messages = formatValidationErrors(validate.errors);
    throw new Error(
      `Environment config validation failed (${resolvedPath}):\n  • ${messages.join('\n  • ')}\n` +
      'Fix the config file and run the command again. See templates/infra/environment-dev.json for a valid example.'
    );
  }
  return {
    environmentConfig: parsed.environmentConfig,
    dryRun: Boolean(parsed.dryRun)
  };
}

/**
 * Loads and validates environment deploy config from a JSON file
 * @param {string} configPath - Absolute or relative path to config JSON
 * @returns {Object} Valid deploy request { environmentConfig, dryRun? }
 * @throws {Error} If file missing, invalid JSON, or validation fails
 */
function loadAndValidateEnvironmentDeployConfig(configPath) {
  const resolvedPath = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Environment config file not found: ${resolvedPath}\n` +
      'Use --config <file> with a JSON file containing "environmentConfig" (e.g. templates/infra/environment-dev.json).'
    );
  }
  const parsed = parseEnvironmentConfigFile(resolvedPath);
  return validateEnvironmentDeployParsed(parsed, resolvedPath);
}

module.exports = {
  normalizePreset,
  buildEnvironmentConfigFromPreset,
  loadAndValidateEnvironmentDeployConfig
};
