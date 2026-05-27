/**
 * Build missing-secrets errors with remediation hints (no secret values).
 *
 * @fileoverview Missing kv:// error message for resolve and env generation
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const { formatMissingSecretsFileInfo } = require('./secrets-helpers');

/**
 * @param {string} line
 * @returns {boolean}
 */
function isCommentOrEmptyLine(line) {
  const t = String(line).trim();
  return t === '' || t.startsWith('#');
}

/**
 * @param {string} kvRef - e.g. kv://hubspot-demo/clientSecret
 * @returns {string}
 */
function kvRefToSecretSetKey(kvRef) {
  const s = String(kvRef || '').trim();
  return s.replace(/^kv:\/\//i, '');
}

/**
 * @param {string} envTemplate
 * @param {string} kvRef
 * @returns {string|null}
 */
function findActiveEnvLineForKvRef(envTemplate, kvRef) {
  if (!envTemplate || !kvRef) return null;
  const needle = String(kvRef).trim();
  for (const line of envTemplate.split('\n')) {
    if (isCommentOrEmptyLine(line)) continue;
    if (line.includes(needle)) return line.trim();
  }
  return null;
}

const OAUTH_STALE_KV_PATH_RE = /\/(clientId|clientSecret|tokenUrl|authorizationUrl)$/i;

/**
 * @param {string[]} missing
 * @returns {boolean}
 */
function hasStaleOAuthTemplatePaths(missing) {
  return missing.some((ref) => OAUTH_STALE_KV_PATH_RE.test(String(ref)));
}

/**
 * @param {string} key
 * @param {Object} secrets
 * @returns {boolean}
 */
function isPopulatedSecretKey(key, secrets) {
  const value = secrets[key];
  return value !== undefined && value !== null && String(value).trim() !== '';
}

/**
 * Other populated secret paths that share the same path segment after the namespace.
 *
 * @param {string} pathStr - Secret path without kv:// (e.g. my-app-e2e/clientId)
 * @param {Object} secrets
 * @returns {string[]}
 */
function findPopulatedAlternateKvPaths(pathStr, secrets) {
  if (!secrets || typeof secrets !== 'object' || !pathStr) {
    return [];
  }
  const slash = pathStr.indexOf('/');
  if (slash <= 0) {
    return [];
  }
  const missingNamespace = pathStr.slice(0, slash);
  const segment = pathStr.slice(slash + 1);
  return Object.keys(secrets).filter((key) => {
    if (typeof key !== 'string' || !key.includes('/')) {
      return false;
    }
    const keySlash = key.indexOf('/');
    const namespace = key.slice(0, keySlash);
    const keySegment = key.slice(keySlash + 1);
    return (
      keySegment === segment &&
      namespace !== missingNamespace &&
      isPopulatedSecretKey(key, secrets)
    );
  });
}

/**
 * @param {string[]} missing - kv:// refs
 * @param {Object} [secrets]
 * @param {string} [appName]
 * @returns {string[]}
 */
function buildKvNamespaceAlternateHints(missing, secrets, appName) {
  const lines = [];
  const seen = new Set();
  for (const ref of missing) {
    const pathStr = kvRefToSecretSetKey(ref);
    for (const alt of findPopulatedAlternateKvPaths(pathStr, secrets)) {
      const line = `Found kv://${alt} in secrets; env.template references kv://${pathStr}.`;
      if (seen.has(line)) {
        continue;
      }
      seen.add(line);
      lines.push(line);
    }
  }
  if (lines.length === 0) {
    return [];
  }
  const repairTail = appName
    ? `Use aifabrix secret set <key> for each missing path, or aifabrix repair ${appName} to align env.template.`
    : 'Use aifabrix secret set <key> for each missing path, or repair to align env.template.';
  lines.push(repairTail);
  return lines;
}

/**
 * @param {Object} opts
 * @param {string[]} opts.missing
 * @param {Object|string|null} [opts.secretsFilePaths]
 * @param {string} [opts.appName]
 * @param {string} [opts.envTemplatePath]
 * @param {string} [opts.envTemplate]
 * @param {Object} [opts.secrets]
 * @returns {string}
 */
function buildMissingSecretsErrorMessage(opts) {
  const { missing, secretsFilePaths, appName, envTemplatePath, envTemplate, secrets } = opts;
  const fileInfo = formatMissingSecretsFileInfo(secretsFilePaths);
  const lines = [`Missing secrets: ${missing.join(', ')}`];
  if (fileInfo) lines.push(fileInfo.trim());
  if (envTemplatePath) lines.push(`Env-template-path: ${envTemplatePath}`);
  for (const ref of missing) {
    const templateLine = findActiveEnvLineForKvRef(envTemplate, ref);
    if (templateLine) lines.push(`Env-template-line: ${ref}|${templateLine}`);
  }
  if (appName) lines.push(`App-name: ${appName}`);
  if (hasStaleOAuthTemplatePaths(missing) && appName) {
    lines.push(`Stale-template-hint: oauth-leftover | repair ${appName}`);
  }
  for (const hint of buildKvNamespaceAlternateHints(missing, secrets, appName)) {
    lines.push(`Alternate-kv-hint: ${hint}`);
  }
  lines.push('Remediation-hint: comment-or-delete-template-line | secret-set');
  return `${lines.join('\n')}\n`;
}

module.exports = {
  kvRefToSecretSetKey,
  findActiveEnvLineForKvRef,
  findPopulatedAlternateKvPaths,
  buildMissingSecretsErrorMessage
};
