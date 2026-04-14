/**
 * Rewrite env lines that hold the declarative token url://vdir-public when the front-door
 * path is inactive. Expansion would yield an empty path; consumers need a non-empty value,
 * so the line is set to "/" only in that case.
 *
 * @fileoverview No schema or manifest keys — fixed "/" when path inactive (same token as url-declarative-resolve-build).
 * Reads application.yaml via {@link module:lib/internal/fs-real-sync} so Jest fs mocks do not hide real files.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

const yaml = require('js-yaml');
const { existsSync, readFileSync } = require('../internal/fs-real-sync');
const { DECLARATIVE_URL_INFRA_DEFAULTS } = require('./infra-env-defaults');
const { computePathActive } = require('./url-declarative-url-flags');

/**
 * Treat common YAML / string forms as enabled (strict `=== true` alone missed some parsers).
 * @param {object|null|undefined} doc
 * @returns {boolean}
 */
function isFrontDoorRoutingEnabledInDoc(doc) {
  const v = doc && doc.frontDoorRouting && doc.frontDoorRouting.enabled;
  return v === true || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Parse application.yaml from disk (real fs — not Jest-mocked require('fs')).
 * @param {string} variablesPath
 * @returns {object|null}
 */
function loadApplicationYamlDoc(variablesPath) {
  if (!variablesPath || !existsSync(variablesPath)) {
    return null;
  }
  try {
    return yaml.load(readFileSync(variablesPath, 'utf8')) || null;
  } catch {
    return null;
  }
}

/** Declarative URL token (matches {@link module:lib/utils/url-declarative-resolve-build} vdir-public). */
const URL_DECLARATIVE_VDIR_PUBLIC_TOKEN = 'url://vdir-public';

/** Value used when front-door path is inactive (would otherwise expand empty). */
const INACTIVE_VDIR_PUBLIC_ENV_FALLBACK =
  DECLARATIVE_URL_INFRA_DEFAULTS.inactiveVdirPublicEnvReplacement;

/**
 * @param {string} content - .env template fragment
 * @param {string} replacement
 * @returns {string}
 */
function applyInactiveVdirPublicTokenRewrite(content, replacement) {
  if (!content || !content.includes(URL_DECLARATIVE_VDIR_PUBLIC_TOKEN)) {
    return content;
  }
  const escaped = URL_DECLARATIVE_VDIR_PUBLIC_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // End line with [ \t]* only — \s would consume \n and strip line endings from the file.
  const lineRe = new RegExp(`^(\\s*[A-Z][A-Z0-9_]*)\\s*=\\s*${escaped}[ \t]*$`, 'gm');
  return content.replace(lineRe, (_, lhs) => `${lhs}=${replacement}`);
}

/**
 * Load application.yaml, compute pathActive, rewrite matching lines to "/" when inactive.
 * @param {string} content
 * @param {string|null|undefined} variablesPath
 * @param {{ traefik?: boolean }} userCfg
 * @returns {string}
 */
function rewriteInactiveDeclarativeVdirPublicContent(content, variablesPath, userCfg) {
  if (!content || !variablesPath || !content.includes(URL_DECLARATIVE_VDIR_PUBLIC_TOKEN)) {
    return content;
  }
  let doc = null;
  try {
    doc = loadApplicationYamlDoc(variablesPath);
  } catch {
    doc = null;
  }
  const pathActive = computePathActive(
    Boolean(userCfg && userCfg.traefik),
    isFrontDoorRoutingEnabledInDoc(doc)
  );
  if (pathActive) {
    return content;
  }
  return applyInactiveVdirPublicTokenRewrite(content, INACTIVE_VDIR_PUBLIC_ENV_FALLBACK);
}

module.exports = {
  URL_DECLARATIVE_VDIR_PUBLIC_TOKEN,
  INACTIVE_VDIR_PUBLIC_ENV_FALLBACK,
  applyInactiveVdirPublicTokenRewrite,
  rewriteInactiveDeclarativeVdirPublicContent
};
