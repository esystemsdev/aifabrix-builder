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

/**
 * @param {Object} opts
 * @param {string[]} opts.missing
 * @param {Object|string|null} [opts.secretsFilePaths]
 * @param {string} [opts.appName]
 * @param {string} [opts.envTemplatePath]
 * @param {string} [opts.envTemplate]
 * @returns {string}
 */
function buildMissingSecretsErrorMessage(opts) {
  const { missing, secretsFilePaths, appName, envTemplatePath, envTemplate } = opts;
  const fileInfo = formatMissingSecretsFileInfo(secretsFilePaths);
  const lines = [`Missing secrets: ${missing.join(', ')}`];
  if (fileInfo) lines.push(fileInfo.trim());
  if (envTemplatePath) lines.push(`Env-template-path: ${envTemplatePath}`);
  for (const ref of missing) {
    const templateLine = findActiveEnvLineForKvRef(envTemplate, ref);
    if (templateLine) lines.push(`Env-template-line: ${ref}|${templateLine}`);
  }
  if (appName) lines.push(`App-name: ${appName}`);
  lines.push('Remediation-hint: comment-or-delete-template-line | secret-set');
  return `${lines.join('\n')}\n`;
}

module.exports = {
  kvRefToSecretSetKey,
  findActiveEnvLineForKvRef,
  buildMissingSecretsErrorMessage
};
