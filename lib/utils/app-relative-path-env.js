/**
 * Per-app virtual-directory env var names ({@code <NAME>_RELATIVE_PATH}) for Builder CLI.
 *
 * @fileoverview {@code app.key} → {@code DATAPLANE_RELATIVE_PATH}, {@code MYAPP_RELATIVE_PATH}, etc.
 * @author AI Fabrix Team
 * @version 1.0.0
 */

'use strict';

/** Must match {@link module:lib/utils/url-declarative-vdir-inactive-env} token (avoid circular require). */
const URL_DECLARATIVE_VDIR_PUBLIC_TOKEN = 'url://vdir-public';

/** Suffix for runtime mount vars derived from {@code application.yaml} {@code app.key}. */
const APP_RELATIVE_PATH_ENV_SUFFIX = '_RELATIVE_PATH';

/**
 * Apps whose runtime vdir env name is not {@code UPPER(appKey)_RELATIVE_PATH}.
 * @type {Readonly<Record<string, string>>}
 */
const APP_RELATIVE_PATH_ENV_KEY_OVERRIDES = Object.freeze({
  keycloak: 'KC_HTTP_RELATIVE_PATH',
  'miso-controller': 'MISO_RELATIVE_PATH'
});

/** Always rewritten to "/" when front-door path is inactive (shared infra apps). */
const INACTIVE_VDIR_PUBLIC_STATIC_ENV_KEYS = Object.freeze([
  'KC_HTTP_RELATIVE_PATH',
  'MISO_RELATIVE_PATH'
]);

/**
 * @param {string} appKey - {@code application.yaml} {@code app.key}
 * @returns {string} e.g. {@code dataplane} → {@code DATAPLANE_RELATIVE_PATH}, {@code myapp} → {@code MYAPP_RELATIVE_PATH}
 */
function appKeyToRelativePathEnvKey(appKey) {
  const key = String(appKey || '').trim();
  if (!key) {
    return '';
  }
  const override = APP_RELATIVE_PATH_ENV_KEY_OVERRIDES[key];
  if (override) {
    return override;
  }
  const upper = key.replace(/-/g, '_').toUpperCase();
  return `${upper}${APP_RELATIVE_PATH_ENV_SUFFIX}`;
}

/**
 * Whether {@code key} is a runtime vdir env name (static Keycloak/Miso or {@code NAME_RELATIVE_PATH}).
 * @param {string} key
 * @returns {boolean}
 */
function isAppRelativePathEnvKey(key) {
  const name = String(key || '').trim();
  if (!name) {
    return false;
  }
  if (INACTIVE_VDIR_PUBLIC_STATIC_ENV_KEYS.includes(name)) {
    return true;
  }
  return name.endsWith(APP_RELATIVE_PATH_ENV_SUFFIX);
}

/**
 * Env keys to rewrite when path is inactive: static Keycloak/Miso + current app vdir key.
 * @param {string|null|undefined} appKey - {@code application.yaml} {@code app.key}
 * @returns {ReadonlySet<string>}
 */
function resolveInactiveVdirRewriteEnvKeys(appKey) {
  const keys = new Set(INACTIVE_VDIR_PUBLIC_STATIC_ENV_KEYS);
  const envKey = appKeyToRelativePathEnvKey(appKey);
  if (envKey) {
    keys.add(envKey);
  }
  return keys;
}

/**
 * When an app is created from a product template, rename the template's {@code *_RELATIVE_PATH}
 * line to match {@code app.key} (e.g. {@code DATAPLANE_RELATIVE_PATH} → {@code MYAPP_RELATIVE_PATH}).
 * @param {string} content - {@code env.template} body
 * @param {string} appKey
 * @returns {string}
 */
function renameAppRelativePathEnvKeyInTemplate(content, appKey) {
  const targetKey = appKeyToRelativePathEnvKey(appKey);
  if (!targetKey || !content || !content.includes(URL_DECLARATIVE_VDIR_PUBLIC_TOKEN)) {
    return content;
  }
  const escapedToken = URL_DECLARATIVE_VDIR_PUBLIC_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineRe = new RegExp(
    `^([ \\t]*)([A-Z][A-Z0-9_]*${APP_RELATIVE_PATH_ENV_SUFFIX})([ \\t]*=\\s*)${escapedToken}[ \\t]*$`,
    'gm'
  );
  return content.replace(lineRe, (match, indent, currentKey, eq) => {
    if (currentKey === targetKey) {
      return match;
    }
    return `${indent}${targetKey}${eq}${URL_DECLARATIVE_VDIR_PUBLIC_TOKEN}`;
  });
}

module.exports = {
  APP_RELATIVE_PATH_ENV_SUFFIX,
  APP_RELATIVE_PATH_ENV_KEY_OVERRIDES,
  INACTIVE_VDIR_PUBLIC_STATIC_ENV_KEYS,
  appKeyToRelativePathEnvKey,
  isAppRelativePathEnvKey,
  resolveInactiveVdirRewriteEnvKeys,
  renameAppRelativePathEnvKeyInTemplate
};
