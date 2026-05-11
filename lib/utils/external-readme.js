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
 * Extracts secret keys from integration/<appName>/env.template when present.
 * Looks for values like `kv://systemKey/apiKey` and returns that key for
 * `aifabrix secret set <key> <value>`.
 *
 * @param {object} args
 * @param {string} args.projectRoot
 * @param {string} args.appName
 * @returns {Array<{path: string, description: string}>}
 */
function extractSecretPathsFromEnvTemplate({ projectRoot, appName }) {
  if (!projectRoot || !appName) return [];

  const envTemplatePath = path.join(projectRoot, 'integration', appName, 'env.template');
  if (!fs.existsSync(envTemplatePath)) return [];

  const raw = _tryReadTextOrNull(envTemplatePath);
  if (raw === null) return [];
  if (typeof raw !== 'string') return [];

  function parseSecretKey(value) {
    if (!value || typeof value !== 'string') return null;
    const kvIdx = value.indexOf('kv://');
    if (kvIdx === -1) return null;
    const after = value.slice(kvIdx + 'kv://'.length);
    const key = after.split(/[ \t#]/)[0]?.trim();
    return key || null;
  }

  function parseLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) return null;
    const varName = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    const key = parseSecretKey(value);
    if (!key) return null;
    return { varName: varName || 'Secret', key };
  }

  const out = [];
  const seen = new Set();

  for (const line of raw.split('\n')) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const dedupeKey = `${parsed.varName}::${parsed.key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ path: parsed.key, description: parsed.varName });
  }

  return out;
}

function _tryReadTextOrNull(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    // Some Jest suites partially mock fs.existsSync; treat missing files as absent templates.
    if (e && e.code === 'ENOENT') return null;
    throw e;
  }
}

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
 * Derives suffix from datasource key for filename generation
 * @param {string} key - Datasource key
 * @param {string} systemKey - System key
 * @param {string} entityType - Fallback entity type
 * @returns {string} Suffix segment
 */
function getDatasourceKeySuffix(key, systemKey, entityType) {
  if (key.startsWith(`${systemKey}-deploy-`)) {
    return key.slice(`${systemKey}-deploy-`.length);
  }
  if (systemKey && key.startsWith(`${systemKey}-`)) {
    return key.slice(systemKey.length + 1);
  }
  if (key) {
    return key;
  }
  return entityType;
}

/**
 * Normalizes a single datasource entry for template use
 * @param {Object} datasource - Datasource object
 * @param {number} index - Index in array
 * @param {string} systemKey - System key for filename generation
 * @param {string} ext - File extension (e.g. '.json', '.yaml')
 * @returns {{entityType: string, displayName: string, fileName: string, datasourceKey: string}} Normalized entry
 */
function normalizeOneDatasource(datasource, index, systemKey, ext) {
  const entityType = datasource.entityType ||
    datasource.entityKey ||
    datasource.key?.split('-').pop() ||
    `entity${index + 1}`;
  const displayName = datasource.displayName ||
    datasource.name ||
    `Datasource ${index + 1}`;
  const key = datasource.key || '';
  const suffix = getDatasourceKeySuffix(key, systemKey, entityType);
  const datasourceKey = key || (systemKey ? `${systemKey}-${suffix}` : suffix);
  const fileName = datasource.fileName || datasource.file ||
    (systemKey ? `${systemKey}-datasource-${suffix}${ext}` : `${suffix}${ext}`);
  return { entityType, displayName, fileName, datasourceKey };
}

/**
 * Normalizes datasource entries for template use
 * @param {Array} datasources - Datasource objects
 * @param {string} systemKey - System key for filename generation
 * @param {string} [fileExt='.json'] - File extension for generated filenames (e.g. '.json', '.yaml')
 * @returns {Array<{entityType: string, displayName: string, fileName: string, datasourceKey: string}>} Normalized entries
 */
function normalizeDatasources(datasources, systemKey, fileExt = '.json') {
  if (!Array.isArray(datasources)) {
    return [];
  }
  const ext = fileExt && fileExt.startsWith('.') ? fileExt : `.${fileExt || 'json'}`;
  return datasources.map((datasource, index) =>
    normalizeOneDatasource(datasource, index, systemKey, ext)
  );
}

/**
 * Builds secret path entries for README "Secrets" section per auth type.
 * Path is the key for `aifabrix secret set <key> <value>` (no kv:// prefix; key format systemKey/secretKey in camelCase).
 * @param {string} systemKey - System key
 * @param {string} [authType] - Authentication type (oauth2, aad, apikey, basic, queryParam, hmac, bearer, token, none)
 * @returns {Array<{path: string, description: string}>} secretPaths for template (path = key for secret set, no kv://)
 */
function buildSecretPaths(systemKey, authType) {
  if (!systemKey || typeof systemKey !== 'string') return [];
  const t = (authType && typeof authType === 'string') ? authType.toLowerCase() : 'apikey';
  const map = {
    oauth2: [{ path: `${systemKey}/clientId`, description: 'Client ID' }, { path: `${systemKey}/clientSecret`, description: 'Client Secret' }],
    oauth: [{ path: `${systemKey}/clientId`, description: 'Client ID' }, { path: `${systemKey}/clientSecret`, description: 'Client Secret' }],
    aad: [{ path: `${systemKey}/clientId`, description: 'Client ID' }, { path: `${systemKey}/clientSecret`, description: 'Client Secret' }],
    apikey: [{ path: `${systemKey}/apiKey`, description: 'API Key' }],
    apiKey: [{ path: `${systemKey}/apiKey`, description: 'API Key' }],
    basic: [{ path: `${systemKey}/username`, description: 'Username' }, { path: `${systemKey}/password`, description: 'Password' }],
    queryparam: [{ path: `${systemKey}/paramValue`, description: 'Query parameter value' }],
    hmac: [{ path: `${systemKey}/signingSecret`, description: 'Signing secret' }],
    bearer: [{ path: `${systemKey}/bearerToken`, description: 'Bearer token' }],
    token: [{ path: `${systemKey}/bearerToken`, description: 'Bearer token' }],
    oidc: [],
    none: []
  };
  return map[t] || map.apikey;
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
 * @param {string} [params.fileExt] - File extension for config files (e.g. '.json', '.yaml'); default '.json'
 * @param {string} [params.authType] - Authentication type for Secrets section (oauth2, aad, apikey, basic, etc.)
 * @param {Object} [params.authentication] - Full authentication object (authType used if authType not set)
 * @returns {Object} Template context
 */
function rbacOptionalFilename(normalizedExt) {
  return normalizedExt === '.yaml' || normalizedExt === '.yml' ? 'rbac.yaml' : 'rbac.json';
}

/**
 * Word-wraps plain description text for Markdown (MD013 ~80 columns). Keeps blank
 * lines between paragraphs.
 * @param {string} text - Raw description
 * @param {number} [maxLen=80] - Target max line length
 * @returns {string}
 */
function wrapPlainTextForMarkdown(text, maxLen = 80) {
  if (!text || typeof text !== 'string') return text;
  const blocks = text.split(/\n\s*\n/);
  const wrapped = blocks.map((block) => {
    const flat = block.replace(/\s+/g, ' ').trim();
    if (!flat) return '';
    const words = flat.split(' ');
    const lines = [];
    let current = '';
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (candidate.length <= maxLen) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
    return lines.join('\n');
  });
  return wrapped.filter(Boolean).join('\n\n');
}

function buildExternalReadmeContext(params = {}) {
  const appName = params.appName || params.systemKey || 'external-system';
  const systemKey = params.systemKey || appName;
  const displayName = params.displayName || formatDisplayName(systemKey);
  const rawDescription = params.description || `External system integration for ${systemKey}`;
  const description = wrapPlainTextForMarkdown(rawDescription);
  const systemType = params.systemType || 'openapi';
  const fileExt = params.fileExt !== undefined ? params.fileExt : '.json';
  const normalizedExt = fileExt && fileExt.startsWith('.') ? fileExt : `.${fileExt || 'json'}`;
  const datasources = normalizeDatasources(params.datasources, systemKey, fileExt);
  const authType = params.authType || params.authentication?.type || params.authentication?.method || params.authentication?.authType;
  const projectRoot = getProjectRoot();
  const secretPathsFromEnv = extractSecretPathsFromEnvTemplate({ projectRoot, appName });
  const secretPaths = secretPathsFromEnv.length > 0 ? secretPathsFromEnv : buildSecretPaths(systemKey, authType);
  const rbacOptionalFile = rbacOptionalFilename(normalizedExt);

  return {
    appName,
    systemKey,
    displayName,
    description,
    systemType,
    fileExt: normalizedExt,
    rbacOptionalFile,
    datasourceCount: datasources.length,
    hasDatasources: datasources.length > 0,
    datasources,
    secretPaths
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
/**
 * Collapses 3+ consecutive newlines to 2 (fixes MD012 from Handlebars spacing).
 * @param {string} md - Markdown body
 * @returns {string}
 */
function collapseConsecutiveBlankLines(md) {
  if (!md || typeof md !== 'string') return md;
  return md.replace(/\n{3,}/g, '\n\n');
}

function generateExternalReadmeContent(params = {}) {
  const template = loadExternalReadmeTemplate();
  const context = buildExternalReadmeContext(params);
  return collapseConsecutiveBlankLines(template(context));
}

module.exports = {
  buildExternalReadmeContext,
  generateExternalReadmeContent,
  wrapPlainTextForMarkdown,
  collapseConsecutiveBlankLines,
  extractSecretPathsFromEnvTemplate
};
