/**
 * Resolves configuration section values for upload (variable → .env, keyvault → secrets)
 * and re-templates configuration on download from env.template.
 *
 * @fileoverview Configuration env resolution for external system upload/download
 * @author AI Fabrix Team
 * @version 2.0.0
 */

const path = require('path');
const fs = require('fs');
const { getIntegrationPath } = require('./paths');
const { parseEnvToMap, resolveKvValue } = require('./credential-secrets-env');
const { loadSecrets, resolveKvReferences } = require('../core/secrets');
const { loadEnvTemplate } = require('./secrets-helpers');
const { getActualSecretsPath } = require('./secrets-path');

const VAR_PLACEHOLDER_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Builds resolved env map and secrets for an integration app (for configuration resolution).
 * If .env exists, parses it; otherwise resolves env.template with secrets and parses the result.
 *
 * @param {string} systemKey - External system key (e.g. 'my-sharepoint')
 * @returns {Promise<{ envMap: Object.<string, string>, secrets: Object }>} envMap for {{VAR}} substitution, secrets for kv://
 * @throws {Error} If env.template is missing when .env is missing (only when building from template)
 */
async function buildResolvedEnvMapForIntegration(systemKey) {
  if (!systemKey || typeof systemKey !== 'string') {
    throw new Error('systemKey is required and must be a string');
  }
  const integrationPath = getIntegrationPath(systemKey);
  const envPath = path.join(integrationPath, '.env');
  const envTemplatePath = path.join(integrationPath, 'env.template');

  let secrets = {};
  try {
    secrets = await loadSecrets(undefined, systemKey);
  } catch {
    secrets = {};
  }

  let envMap = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    envMap = parseEnvToMap(content);
  } else if (fs.existsSync(envTemplatePath)) {
    const templateContent = loadEnvTemplate(envTemplatePath);
    const secretsPaths = await getActualSecretsPath(undefined, systemKey);
    const resolvedContent = await resolveKvReferences(
      templateContent,
      secrets,
      'local',
      secretsPaths,
      systemKey
    );
    envMap = parseEnvToMap(resolvedContent);
  }
  return { envMap, secrets };
}

/**
 * Resolves {{VAR}} in a string using envMap. Throws if any variable is missing.
 *
 * @param {string} value - Value that may contain {{VAR}}
 * @param {Object.<string, string>} envMap - Resolved env key-value map
 * @param {string} [systemKey] - System key for error message
 * @returns {string} Value with {{VAR}} replaced
 * @throws {Error} If a {{VAR}} is missing from envMap
 */
function substituteVarPlaceholders(value, envMap, systemKey) {
  const hint = systemKey ? ` Run 'aifabrix resolve ${systemKey}' or set the variable in .env.` : '';
  return value.replace(VAR_PLACEHOLDER_REGEX, (match, varName) => {
    const key = varName.trim();
    if (envMap[key] === undefined || envMap[key] === null) {
      throw new Error(`Missing configuration env var: ${key}.${hint}`);
    }
    return String(envMap[key]);
  });
}

/**
 * Resolves configuration array values in place by location: variable → {{VAR}} from envMap;
 * keyvault → kv:// from secrets. Does not log or expose secret values.
 *
 * @param {Array<{ name?: string, value?: string, location?: string }>} configArray - Configuration array (mutated)
 * @param {Object.<string, string>} envMap - Resolved env map from buildResolvedEnvMapForIntegration
 * @param {Object} secrets - Loaded secrets for kv:// resolution
 * @param {string} [systemKey] - System key for error messages
 * @throws {Error} If variable env is missing or keyvault secret unresolved (message never contains secret values)
 */
function resolveConfigurationValues(configArray, envMap, secrets, systemKey) {
  if (!Array.isArray(configArray)) return;
  const hint = systemKey ? ` Run 'aifabrix resolve ${systemKey}' and ensure the key exists in the secrets file.` : '';
  for (const item of configArray) {
    if (!item || typeof item.value !== 'string') continue;
    const location = (item.location || '').toLowerCase();
    if (location === 'variable') {
      if (item.value.trim().startsWith('kv://')) {
        throw new Error(`Configuration entry '${item.name || 'unknown'}' has location 'variable' but value is kv://. Use location 'keyvault' for secrets.`);
      }
      item.value = substituteVarPlaceholders(item.value, envMap, systemKey);
    } else if (location === 'keyvault') {
      const resolved = resolveKvValue(secrets, item.value);
      if (resolved === null || resolved === undefined) {
        throw new Error(`Unresolved keyvault reference for configuration '${item.name || 'unknown'}'.${hint}`);
      }
      item.value = resolved;
    }
  }
}

/**
 * Returns the set of variable names (keys) defined in env.template content.
 *
 * @param {string} envTemplateContent - Raw env.template content
 * @returns {Set<string>} Set of variable names
 */
function getEnvTemplateVariableNames(envTemplateContent) {
  const names = new Set();
  if (!envTemplateContent || typeof envTemplateContent !== 'string') return names;
  const lines = envTemplateContent.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.substring(0, eq).trim();
      if (key) names.add(key);
    }
  }
  return names;
}

/**
 * Re-templates configuration from env.template: for each entry with location === 'variable'
 * whose name matches a key in env.template, sets value to {{name}}. Mutates configArray in place.
 *
 * @param {Array<{ name?: string, value?: string, location?: string }>} configArray - Configuration array (mutated)
 * @param {Set<string>} envTemplateVariableNames - Variable names present in env.template
 */
function retemplateConfigurationFromEnvTemplate(configArray, envTemplateVariableNames) {
  if (!Array.isArray(configArray) || !envTemplateVariableNames || !envTemplateVariableNames.size) return;
  for (const item of configArray) {
    if (!item || (item.location || '').toLowerCase() !== 'variable') continue;
    const name = item.name && String(item.name).trim();
    if (name && envTemplateVariableNames.has(name)) {
      item.value = `{{${name}}}`;
    }
  }
}

/**
 * Reads env.template at integration path, re-templates the given configuration array,
 * and returns the updated array (mutates in place). If env.template is missing, does nothing.
 *
 * @param {string} systemKey - External system key
 * @param {Array<{ name?: string, value?: string, location?: string }>} configArray - Configuration array (mutated)
 * @returns {Promise<boolean>} True if re-templating was applied (env.template existed)
 */
async function retemplateConfigurationForDownload(systemKey, configArray) {
  if (!systemKey || typeof systemKey !== 'string' || !Array.isArray(configArray)) return false;
  const integrationPath = getIntegrationPath(systemKey);
  const envTemplatePath = path.join(integrationPath, 'env.template');
  if (!fs.existsSync(envTemplatePath)) return false;
  const content = fs.readFileSync(envTemplatePath, 'utf8');
  const names = getEnvTemplateVariableNames(content);
  retemplateConfigurationFromEnvTemplate(configArray, names);
  return true;
}

module.exports = {
  buildResolvedEnvMapForIntegration,
  resolveConfigurationValues,
  getEnvTemplateVariableNames,
  retemplateConfigurationFromEnvTemplate,
  retemplateConfigurationForDownload,
  substituteVarPlaceholders
};
