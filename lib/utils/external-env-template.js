/**
 * Builds Handlebars context and generates env.template content for external systems.
 * Single source for create, download, split, and repair so env.template structure is consistent.
 *
 * @fileoverview External system env.template generation
 * @author AI Fabrix Team
 * @version 2.0.0
 */

'use strict';

const path = require('path');
const fs = require('fs');
const Handlebars = require('handlebars');
const { systemKeyToKvPrefix, kvEnvKeyToPath, securityKeyToVar } = require('./credential-secrets-env');

/**
 * Builds hint string from portalInput (options → enum, validation → min-max or pattern).
 * @param {Object} portalInput - Portal input config (label, options, validation)
 * @returns {string} Hint suffix for comment
 */
function buildPortalInputHint(portalInput) {
  if (!portalInput || typeof portalInput !== 'object') return '';
  const parts = [];
  if (Array.isArray(portalInput.options) && portalInput.options.length > 0) {
    parts.push(`enum ${portalInput.options.join(',')}`);
  }
  const v = portalInput.validation;
  if (v && typeof v === 'object') {
    if (typeof v.minLength === 'number' || typeof v.maxLength === 'number') {
      parts.push('min-max');
    } else if (typeof v.pattern === 'string' && v.pattern) {
      parts.push('pattern');
    }
  }
  return parts.length ? ` - ${parts.join(', ')}` : '';
}

/** Fallback security keys by auth method when authentication.security is absent. */
const FALLBACK_SECURITY_BY_AUTH = {
  oauth2: ['clientId', 'clientSecret'],
  oauth: ['clientId', 'clientSecret'],
  aad: ['clientId', 'clientSecret'],
  apikey: ['apiKey'],
  apiKey: ['apiKey'],
  basic: ['username', 'password'],
  queryParam: ['paramValue'],
  oidc: [],
  hmac: ['signingSecret'],
  bearer: ['bearerToken'],
  token: ['bearerToken'],
  none: []
};

/**
 * Builds authSecureVars array from system authentication.security (or fallback by auth type).
 * @param {Object} system - System object with key and authentication
 * @returns {Array<{name: string, value: string}>}
 */
function buildAuthSecureVarsFromSystem(system) {
  const authSecureVars = [];
  const systemKey = system?.key || 'external-system';
  const prefix = systemKeyToKvPrefix(systemKey);
  if (!prefix) return authSecureVars;
  const security = system?.authentication?.security || system?.auth?.security;
  const authMethod = (system?.authentication?.method || system?.authentication?.type ||
    system?.auth?.method || system?.auth?.type || 'apikey').toLowerCase();
  if (security && typeof security === 'object' && Object.keys(security).length > 0) {
    for (const key of Object.keys(security)) {
      const envName = `KV_${prefix}_${securityKeyToVar(key)}`;
      const pathVal = kvEnvKeyToPath(envName, systemKey);
      authSecureVars.push({ name: envName, value: pathVal || `kv://${systemKey}/${key}` });
    }
  } else {
    const keys = FALLBACK_SECURITY_BY_AUTH[authMethod] || FALLBACK_SECURITY_BY_AUTH.apikey;
    for (const key of keys) {
      authSecureVars.push({
        name: `KV_${prefix}_${securityKeyToVar(key)}`,
        value: `kv://${systemKey}/${key}`
      });
    }
  }
  return authSecureVars;
}

/**
 * Builds configuration array with name, value, comment from system.configuration.
 * @param {Object} system - System object with configuration array
 * @returns {Array<{name: string, value: string, comment: string}>}
 */
function buildConfigurationEntries(system) {
  const configuration = [];
  const configList = Array.isArray(system?.configuration) ? system.configuration : [];
  for (const entry of configList) {
    if (!entry || !entry.name) continue;
    const label = entry.portalInput?.label || entry.name;
    const hint = buildPortalInputHint(entry.portalInput || {});
    let value = entry.value !== undefined && entry.value !== null ? String(entry.value) : '';
    if (entry.location === 'keyvault' && value && !value.startsWith('kv://')) value = `kv://${value}`;
    configuration.push({ name: entry.name, value, comment: `${label}${hint}` });
  }
  return configuration;
}

/**
 * Builds template context from system object for env.template.hbs.
 * @param {Object} system - Full system object (e.g. deployment.system or parsed system file)
 * @returns {{ authMethod: string, authSecureVars: Array<{name: string, value: string}>, authNonSecureVarNames: string[], configuration: Array<{name: string, value: string, comment: string}> }}
 */
function buildExternalEnvTemplateContext(system) {
  const authMethod = (system?.authentication?.method ||
    system?.authentication?.type ||
    system?.auth?.method ||
    system?.auth?.type ||
    'apikey').toLowerCase();
  const authSecureVars = buildAuthSecureVarsFromSystem(system);
  const authVars = system?.authentication?.variables || system?.auth?.variables || {};
  const authNonSecureVarNames = Object.keys(authVars);
  const configuration = buildConfigurationEntries(system);
  return {
    authMethod,
    authSecureVars,
    authNonSecureVarNames,
    configuration
  };
}

/** Inline fallback when env.template.hbs is missing or unreadable (e.g. CI path or bundled). */
const DEFAULT_ENV_TEMPLATE_HBS = `# Environment variables for external system integration
# Use kv:// (or aifabrix secret set) for sensitive values; plain values for non-sensitive configuration.
#

{{#if authMethod}}
# Authentication
# Type: {{authMethod}}
{{#each authSecureVars}}
{{name}}={{value}}
{{/each}}
{{#if authNonSecureVarNames}}
# Non-secure (e.g. URLs): {{#each authNonSecureVarNames}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{/if}}
{{#if configuration.length}}
# Configuration
{{#each configuration}}
# {{comment}}
{{name}}={{value}}
{{/each}}
{{/if}}
`;

/**
 * Generates env.template content from system using the Handlebars template.
 * @param {Object} system - Full system object (e.g. deployment.system or parsed system file)
 * @returns {string} Rendered env.template content
 */
function generateExternalEnvTemplateContent(system) {
  if (!system || typeof system !== 'object') {
    return '# Environment variables for external system integration\n# Use kv:// (or aifabrix secret set) for sensitive values.\n\n';
  }
  let templateContent;
  try {
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'external-system', 'env.template.hbs');
    templateContent = fs.readFileSync(templatePath, 'utf8');
  } catch (_) {
    templateContent = undefined;
  }
  if (typeof templateContent !== 'string' || !templateContent.trim()) {
    templateContent = DEFAULT_ENV_TEMPLATE_HBS;
  }
  const template = Handlebars.compile(templateContent);
  const context = buildExternalEnvTemplateContext(system);
  return template(context);
}

module.exports = {
  buildExternalEnvTemplateContext,
  generateExternalEnvTemplateContent
};
